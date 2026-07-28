/**
 * LLM transport.
 *
 * The browser only ever talks to the proxy, which holds the site owner's
 * OpenRouter key and forwards to a single allowlisted model. No credential
 * reaches the browser, so nothing here can leak one.
 *
 * In development the proxy is the Vite middleware in vite.config.mjs. For a
 * deployed build, implement the same POST /chat route server-side and point
 * VITE_LLM_PROXY_URL at it.
 */
import { MODEL_ID } from './model.mjs'

// Full endpoint URL, overridable at build time. The default matches the Vite
// dev middleware; a deployed build points this at whatever serves the same
// route there (see deploy/php/). Relative so a build also works when the site
// lives in a subdirectory.
const ENDPOINT = import.meta.env.VITE_LLM_ENDPOINT ?? './api/llm/chat'

// ─── Error reporting ────────────────────────────────────────────────────────

/**
 * Pull the useful text out of an upstream provider's error payload.
 * OpenRouter nests it under error.metadata.raw, often as a JSON string, which
 * is why the top-level message is the useless "Provider returned error".
 */
function unwrapRaw(raw) {
  if (raw == null) return null
  let v = raw
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v)
    } catch {
      return v.slice(0, 300)
    }
  }
  return v?.error?.message ?? v?.message ?? JSON.stringify(v).slice(0, 300)
}

/** Build the most specific message the response allows. */
function describeError(err, status) {
  if (!err) return `HTTP ${status}`
  if (typeof err === 'string') return err

  const parts = []
  const detail = unwrapRaw(err.metadata?.raw)

  // Prefer the provider's own wording over OpenRouter's generic wrapper.
  parts.push(detail ?? err.message ?? `HTTP ${status}`)
  if (detail && err.message && !detail.includes(err.message)) parts.push(`(${err.message})`)

  if (err.metadata?.provider_name) parts.push(`provider: ${err.metadata.provider_name}`)
  if (err.metadata?.reasons) parts.push(`reasons: ${[].concat(err.metadata.reasons).join(', ')}`)
  if (err.code && err.code !== status) parts.push(`code: ${err.code}`)

  if (status === 401) parts.push('→ the API key is invalid')
  if (status === 402) parts.push('→ the account is out of credits')
  if (status === 429) {
    const wait = err.metadata?.retry_after_seconds
    parts.push(wait ? `→ rate limited; retry in ${wait}s` : '→ rate limited; wait a moment and retry')
  }

  return parts.join(' · ')
}

// ─── Chat ───────────────────────────────────────────────────────────────────

/**
 * Send a chat completion request.
 * @param {{role: string, content: string}[]} messages
 * @returns {Promise<string>} the assistant's reply text
 */
export async function chat(messages) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_ID,
      messages,
      temperature: 0.2,
      // Measured on a detailed H-beam request: reasoning burned 1,288 of 2,052
      // output tokens and 35.7s. Turning it off gave the same drawing in 7.9s
      // for 40% of the cost. 'low' effort did not help — only disabling does.
      // This DSL is small and fully specified, so there is nothing to reason
      // about; revisit if generations start failing the parser more often.
      reasoning: { enabled: false },
    }),
  })

  let body
  try {
    body = await res.json()
  } catch {
    throw new Error(`Proxy returned a non-JSON response (HTTP ${res.status})`)
  }
  if (!res.ok) {
    console.error('LLM request failed', res.status, body)
    throw new Error(describeError(body?.error, res.status))
  }

  const choice = body.choices?.[0]
  const text = choice?.message?.content
  if (typeof text === 'string' && text.trim()) return text

  // Empty content has several distinct causes; say which one it was, because
  // "empty response" alone gives no clue whether to retry or give up.
  // OpenRouter can report a provider failure in a 200 response, so check here too.
  if (body.error) {
    console.error('LLM error payload', body)
    throw new Error(describeError(body.error, 200))
  }

  const reason = choice?.finish_reason ?? choice?.native_finish_reason ?? 'unknown'
  if (reason === 'length') {
    throw new Error(
      'Model hit its token limit before producing any output — reasoning consumed the whole budget.',
    )
  }
  if (choice?.message?.reasoning ?? choice?.message?.reasoning_content) {
    throw new Error(`Model returned reasoning but no answer (finish_reason: ${reason}).`)
  }
  throw new Error(`Model returned an empty response (finish_reason: ${reason}).`)
}

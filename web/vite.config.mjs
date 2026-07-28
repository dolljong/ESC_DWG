import { defineConfig, loadEnv } from 'vite'
import { MODEL_ID } from './src/llm/model.mjs'

const OPENROUTER = 'https://openrouter.ai/api/v1'

// Reasoning tokens count against max_tokens on models that think, and too small
// a budget returns empty content with finish_reason 'length'.
const MAX_TOKENS = 16000

/** Read a JSON request body from a Node IncomingMessage. */
function readJson(req) {
    return new Promise((resolve, reject) => {
        let raw = ''
        req.on('data', (c) => (raw += c))
        req.on('end', () => {
            try { resolve(JSON.parse(raw || '{}')) } catch (e) { reject(e) }
        })
        req.on('error', reject)
    })
}

/**
 * Dev-only proxy at /api/llm, standing in for the site owner's key.
 *
 * This is the "owner pays" path: visitors who have not connected their own
 * OpenRouter account use this one. The key stays in the Node process —
 * OPENROUTER_API_KEY has no VITE_ prefix, so Vite never inlines it into the
 * client bundle — and `apply: 'serve'` keeps all of it out of a production
 * build.
 *
 * Deploying means reimplementing this same route somewhere that runs
 * server-side (a Cloudflare Worker, say) and pointing VITE_LLM_PROXY_URL at it.
 *
 * The single-model allowlist is the spend guard: an abused proxy can only ever
 * run the cheapest model this app was designed around, never an expensive one.
 */
function llmProxyPlugin(env) {
    return {
        name: 'llm-proxy',
        apply: 'serve',
        configureServer(server) {
            const key = env.OPENROUTER_API_KEY || env.LLM_API_KEY || ''
            server.config.logger.info(
                `  ➜  LLM proxy: ${MODEL_ID}${key ? '' : '  (API key MISSING — see .env.example)'}`,
            )

            server.middlewares.use('/api/llm', async (req, res) => {
                const send = (status, obj) => {
                    res.statusCode = status
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify(obj))
                }

                if (!key) {
                    return send(500, {
                        error: 'No shared OpenRouter key configured. Set OPENROUTER_API_KEY in web/.env.local (see .env.example), or connect your own account.',
                    })
                }

                if (!req.url.startsWith('/chat')) return send(404, { error: 'Unknown route' })

                try {
                    const body = await readJson(req)
                    if (body.model !== MODEL_ID) {
                        return send(400, { error: `Only ${MODEL_ID} is allowed here.` })
                    }

                    const r = await fetch(`${OPENROUTER}/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${key}`,
                            'HTTP-Referer': 'http://localhost:5173',
                            'X-Title': 'ESC_DWG',
                        },
                        body: JSON.stringify({
                            ...body,
                            model: MODEL_ID,
                            max_tokens: Math.min(body.max_tokens ?? MAX_TOKENS, MAX_TOKENS),
                            stream: false,
                        }),
                    })

                    // Pass the payload through untouched so the client can unwrap
                    // the provider's own error, and echo failures to the terminal
                    // where the full text is easiest to read.
                    const text = await r.text()
                    let payload
                    try {
                        payload = JSON.parse(text)
                    } catch {
                        console.error(`[llm-proxy] non-JSON upstream (HTTP ${r.status}):`, text.slice(0, 1000))
                        return send(502, {
                            error: { message: `Upstream returned non-JSON (HTTP ${r.status})` },
                        })
                    }
                    if (!r.ok || payload.error) {
                        console.error(
                            `[llm-proxy] failed (HTTP ${r.status}):`,
                            JSON.stringify(payload.error ?? payload, null, 2),
                        )
                    }
                    return send(r.status, payload)
                } catch (e) {
                    console.error('[llm-proxy]', e)
                    send(502, { error: e.message })
                }
            })
        },
    }
}

export default defineConfig(({ mode }) => {
    // '' prefix → load unprefixed vars too (they stay server-side).
    const env = loadEnv(mode, process.cwd(), '')
    return {
        base: './',
        plugins: [llmProxyPlugin(env)],
    }
})

/**
 * Generate-verify-repair loop.
 *
 * The script parser is the verifier: it already returns structured
 * {line, message} errors, so a failed generation can be fed straight back to
 * the model. Free models vary a lot in quality and this loop is what makes
 * them usable.
 */
import { parseScript } from '../script-parser.js'
import { SYSTEM_PROMPT, EXAMPLES } from './script-spec.js'
import { chat } from './openrouter.js'

const MAX_REPAIRS = 2

/**
 * Strip a ``` fence if the model wrapped its answer in one.
 *
 * The opening line is matched loosely: models emit a bare fence, a language
 * tag, and — observed from cohere/north-mini-code — a fence with a trailing
 * space, which a stricter pattern misses and leaves as a syntax error. The
 * closing fence is optional so a truncated reply still yields its body.
 */
function extractScript(reply) {
  const text = String(reply).trim()
  const fenced = text.match(/```[^\n]*\r?\n([\s\S]*?)(?:```|$)/)
  return (fenced ? fenced[1] : text).trim()
}

function repairPrompt(errors, entityCount) {
  if (errors.length === 0 && entityCount === 0) {
    return 'That script parsed but produced no geometry. Emit a corrected script that actually draws something. Reply with the script only.'
  }
  const list = errors.map((e) => `  line ${e.line}: ${e.message}`).join('\n')
  return `That script failed to parse:\n\n${list}\n\nFix these errors and reply with the complete corrected script only.`
}

/**
 * Turn a natural-language request into a validated script.
 *
 * @param {object}   opts
 * @param {string}   opts.userMessage    what the user asked for
 * @param {Array}    [opts.history]      prior {role, content} turns
 * @param {string}   [opts.currentScript] script in the editor, for revisions
 * @param {Function} [opts.onProgress]   status callback
 * @returns {Promise<{ok, script, errors, attempts, messages}>}
 */
export async function generateScript({
  userMessage,
  history = [],
  currentScript = '',
  onProgress,
}) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...EXAMPLES.flatMap((ex) => [
      { role: 'user', content: ex.user },
      { role: 'assistant', content: ex.assistant },
    ]),
    ...history,
  ]

  if (currentScript.trim()) {
    messages.push({
      role: 'user',
      content: `The current script is:\n\`\`\`\n${currentScript.trim()}\n\`\`\`\nApply the next request to it and reply with the complete updated script.`,
    })
  }
  messages.push({ role: 'user', content: userMessage })

  let script = ''
  let errors = []

  for (let attempt = 0; attempt <= MAX_REPAIRS; attempt++) {
    onProgress?.(attempt === 0 ? 'Generating…' : `Fixing errors (${attempt}/${MAX_REPAIRS})…`)

    const reply = await chat(messages)
    script = extractScript(reply)

    const parsed = parseScript(script)
    errors = parsed.errors

    if (errors.length === 0 && parsed.entities.length > 0) {
      return { ok: true, script, errors: [], attempts: attempt + 1, messages }
    }

    messages.push({ role: 'assistant', content: reply })
    messages.push({ role: 'user', content: repairPrompt(errors, parsed.entities.length) })
  }

  // Out of retries — hand back the last attempt so the user can fix it by hand.
  return { ok: false, script, errors, attempts: MAX_REPAIRS + 1, messages }
}

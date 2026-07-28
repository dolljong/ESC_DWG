/**
 * Chat panel: natural-language request → validated script → rendered drawing.
 */
import { MODEL_LABEL } from './model.mjs'
import { generateScript } from './agent.js'

export function initChat({ getScript, setScript, run }) {
  const log = document.getElementById('chat-log')
  const input = document.getElementById('chat-input')
  const sendBtn = document.getElementById('chat-send')
  const modelLabel = document.getElementById('model-label')

  /** Successful turns only — repair chatter is not worth re-sending. */
  const history = []
  let busy = false

  // ── Log helpers ───────────────────────────────────────────────────────────
  function addMessage(role, text) {
    const el = document.createElement('div')
    el.className = `chat-msg ${role}`
    el.textContent = text
    log.appendChild(el)
    log.scrollTop = log.scrollHeight
    return el
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  async function send() {
    const text = input.value.trim()
    if (!text || busy) return

    busy = true
    sendBtn.disabled = true
    input.value = ''
    addMessage('user', text)
    const statusEl = addMessage('status', 'Generating…')

    // A slow generation plus up to two repair rounds can run a while; without a
    // ticker the panel looks frozen. Keep the phase text and append elapsed time.
    let phase = 'Generating…'
    const startedAt = Date.now()
    const ticker = setInterval(() => {
      const secs = Math.round((Date.now() - startedAt) / 1000)
      statusEl.textContent = `${phase}  ${secs}s`
    }, 1000)

    try {
      const result = await generateScript({
        userMessage: text,
        history: [...history],
        currentScript: getScript(),
        onProgress: (msg) => {
          phase = msg
        },
      })

      // Always show the script — even a failed one is a useful starting point.
      setScript(result.script)

      if (result.ok) {
        statusEl.remove()
        const note =
          result.attempts > 1
            ? `Done (fixed after ${result.attempts - 1} retry${result.attempts > 2 ? 'ies' : ''})`
            : 'Done'
        addMessage('assistant', note)
        history.push({ role: 'user', content: text })
        history.push({ role: 'assistant', content: result.script })
        run()
      } else {
        statusEl.remove()
        addMessage(
          'error',
          `Could not produce a valid script after ${result.attempts} attempts. ` +
            `The last attempt is in the editor:\n` +
            result.errors.map((e) => `line ${e.line}: ${e.message}`).join('\n'),
        )
      }
    } catch (err) {
      statusEl.remove()
      addMessage('error', err.message)
    } finally {
      clearInterval(ticker)
      busy = false
      sendBtn.disabled = false
      input.focus()
    }
  }

  sendBtn.addEventListener('click', send)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  })

  modelLabel.textContent = MODEL_LABEL
}

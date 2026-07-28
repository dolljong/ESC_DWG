import { DxfViewer } from 'dxf-viewer';
import { parseScript } from './script-parser.js';
import { generateDxf } from './dxf-generator.js';
import { SCRIPT_HELP_HTML } from './script-help.js';
import { initChat } from './llm/chat-ui.js';

// ─── Viewer initialisation ─────────────────────────────────────────────────
const container = document.getElementById('viewer');
const viewer = new DxfViewer(container, {
  autoResize: true,
  antialias: true,
  blackWhiteInversion: true,
  colorCorrection: true,
});
viewer.Subscribe('message', (e) => console.log('Viewer message:', e));

// ─── DOM references ─────────────────────────────────────────────────────────
const fileInput     = document.getElementById('fileInput');
const fileName      = document.getElementById('fileName');
const status        = document.getElementById('status');
const toggleBtn     = document.getElementById('toggleScript');
const scriptPanel   = document.getElementById('script-panel');
const scriptEditor  = document.getElementById('script-editor');
const runScriptBtn  = document.getElementById('run-script-btn');
const errorsDiv     = document.getElementById('script-errors');
const helpBtn       = document.getElementById('showHelp');
const helpOverlay   = document.getElementById('help-overlay');
const helpBody      = document.getElementById('help-body');

// ─── Load DXF helper ────────────────────────────────────────────────────────
async function loadDxf(url, name) {
  fileName.textContent = name;
  status.textContent = 'Loading...';
  try {
    viewer.Clear();
    await viewer.Load({
      url,
      fonts: ['./fonts/malgun.ttf'],
      progressCbk: (phase, processed, total) => {
        const pct = total ? Math.round((processed / total) * 100) : 0;
        status.textContent = `${phase}: ${pct}%`;
      },
      workerFactory: null,
    });
    status.textContent = 'Done';
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    console.error(err);
  }
}

// ─── File open ──────────────────────────────────────────────────────────────
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await loadDxf(URL.createObjectURL(file), file.name);
});

// ─── Load example ───────────────────────────────────────────────────────────
document.getElementById('loadExample').addEventListener('click', () => {
  loadDxf('./T-011.dxf', 'T-011.dxf');
});

// ─── Script panel toggle ────────────────────────────────────────────────────
toggleBtn.addEventListener('click', () => {
  scriptPanel.classList.toggle('visible');
  toggleBtn.classList.toggle('active');
  // Trigger viewer resize after layout change
  window.dispatchEvent(new Event('resize'));
});

// ─── Script help dialog ─────────────────────────────────────────────────────
// Content is static authored markup from script-help.js, never user input.
helpBody.innerHTML = SCRIPT_HELP_HTML;

function setHelpVisible(visible) {
  helpOverlay.classList.toggle('visible', visible);
  helpBtn.classList.toggle('active', visible);
  // Always reopen at the top rather than wherever the last reader left off.
  if (visible) helpBody.scrollTop = 0;
}

helpBtn.addEventListener('click', () => {
  setHelpVisible(!helpOverlay.classList.contains('visible'));
});
document.getElementById('help-close').addEventListener('click', () => setHelpVisible(false));

// Clicking the backdrop closes; clicking inside the dialog must not.
helpOverlay.addEventListener('click', (e) => {
  if (e.target === helpOverlay) setHelpVisible(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setHelpVisible(false);
});

// ─── Run script ─────────────────────────────────────────────────────────────
runScriptBtn.addEventListener('click', runScript);

async function runScript() {
  const script = scriptEditor.value.trim();
  if (!script) return;

  // Parse
  const { entities, errors } = parseScript(script);

  // Show / hide errors
  if (errors.length > 0) {
    errorsDiv.style.display = 'block';
    errorsDiv.textContent = errors.map((e) => `Line ${e.line}: ${e.message}`).join('\n');
  } else {
    errorsDiv.style.display = 'none';
    errorsDiv.textContent = '';
  }

  if (entities.length === 0) return;

  // Generate DXF
  try {
    const dxfString = generateDxf(entities);
    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    await loadDxf(url, 'script output');
  } catch (err) {
    errorsDiv.style.display = 'block';
    errorsDiv.textContent += `\nDXF generation error: ${err.message}`;
    console.error(err);
  }
}

// ─── AI chat panel ──────────────────────────────────────────────────────────
initChat({
  getScript: () => scriptEditor.value,
  setScript: (s) => { scriptEditor.value = s; },
  run: runScript,
});

// ─── Tab key support in textarea ────────────────────────────────────────────
scriptEditor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = scriptEditor.selectionStart;
    const end = scriptEditor.selectionEnd;
    scriptEditor.value =
      scriptEditor.value.substring(0, start) + '    ' + scriptEditor.value.substring(end);
    scriptEditor.selectionStart = scriptEditor.selectionEnd = start + 4;
  }
});

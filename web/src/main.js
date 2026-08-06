import { DxfViewer } from 'dxf-viewer';
import { parseScript } from './script-parser.js';
import { generateDxf } from './dxf-generator.js';
import { SCRIPT_HELP_HTML } from './script-help.js';
import { SCRIPT_EXAMPLES } from './script-examples.js';
import { createPointOverlay } from './point-labels.js';
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
const saveDxfBtn    = document.getElementById('save-dxf-btn');
const errorsDiv     = document.getElementById('script-errors');
const pointsBtn     = document.getElementById('show-points-btn');
const helpBtn       = document.getElementById('showHelp');
const helpOverlay   = document.getElementById('help-overlay');
const helpBody      = document.getElementById('help-body');
const exampleSelect = document.getElementById('example-select');

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

// ─── Example scripts ────────────────────────────────────────────────────────
// The dropdown owns the editor's initial content, so the examples file is the
// single source of truth for it rather than markup in index.html.
SCRIPT_EXAMPLES.forEach((ex, i) => {
  const opt = document.createElement('option');
  opt.value = String(i);
  opt.textContent = ex.name;
  exampleSelect.appendChild(opt);
});

/** Text of the example currently in the editor, to detect the user's own edits. */
let loadedExample = SCRIPT_EXAMPLES[0].script;
scriptEditor.value = loadedExample;

exampleSelect.addEventListener('change', () => {
  const ex = SCRIPT_EXAMPLES[Number(exampleSelect.value)];
  // Hand-written work is the one thing here that cannot be recovered — an
  // untouched example can always be picked again.
  if (scriptEditor.value.trim() && scriptEditor.value !== loadedExample) {
    if (!confirm(`편집한 내용이 사라집니다. "${ex.name}" 예제를 불러올까요?`)) {
      // Put the picker back on whatever is actually in the editor.
      const prev = SCRIPT_EXAMPLES.findIndex((e) => e.script === loadedExample);
      exampleSelect.value = String(prev === -1 ? 0 : prev);
      return;
    }
  }
  loadedExample = ex.script;
  scriptEditor.value = ex.script;
  runScript();
});

// ─── Point name overlay ─────────────────────────────────────────────────────
// Red dot + name at every point the script defines, so a drawing can be talked
// about — and asked of the AI — by point name rather than by coordinate.
const pointOverlay = createPointOverlay(viewer, container);

pointsBtn.addEventListener('click', () => {
  const on = !pointOverlay.isVisible();
  pointsBtn.classList.toggle('active', on);
  pointOverlay.setVisible(on);
  // Show what is in the editor right now, which need not be what was last run.
  if (on) refreshPoints();
});

/**
 * Re-read the points from the editor without touching the error panel.
 *
 * Typing is not a failed run: half-written lines would otherwise flash errors
 * at every keystroke. Whatever parses still yields its points, so a new point
 * appears the moment its line is complete.
 */
function refreshPoints() {
  if (!pointOverlay.isVisible()) return;
  pointOverlay.setPoints(parseScript(scriptEditor.value).points);
}

scriptEditor.addEventListener('input', refreshPoints);

// ─── Run script ─────────────────────────────────────────────────────────────
runScriptBtn.addEventListener('click', runScript);

/** Parse the editor, reporting any errors in the panel. */
function parseEditor() {
  const script = scriptEditor.value.trim();
  if (!script) return [];

  const { entities, points, errors } = parseScript(script);

  if (errors.length > 0) {
    errorsDiv.style.display = 'block';
    errorsDiv.textContent = errors.map((e) => `Line ${e.line}: ${e.message}`).join('\n');
  } else {
    errorsDiv.style.display = 'none';
    errorsDiv.textContent = '';
  }
  pointOverlay.setPoints(points);
  return entities;
}

async function runScript() {
  const entities = parseEditor();
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

// ─── Save DXF ───────────────────────────────────────────────────────────────
// Downloads what the script describes, not what the viewer happens to be
// showing: the file is written with forCad so donuts and solids arrive as
// entities a CAD user can edit rather than as the triangles the viewer needs.
saveDxfBtn.addEventListener('click', () => {
  const entities = parseEditor();
  if (entities.length === 0) return;

  let dxfString;
  try {
    dxfString = generateDxf(entities, { forCad: true });
  } catch (err) {
    errorsDiv.style.display = 'block';
    errorsDiv.textContent += `\nDXF generation error: ${err.message}`;
    console.error(err);
    return;
  }

  const url = URL.createObjectURL(new Blob([dxfString], { type: 'application/dxf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = dxfFileName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking straight away can cancel the download in some browsers; one turn
  // of the event loop is enough for it to have started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

/**
 * Name the download after the example in the editor, so saving several in a row
 * does not produce a pile of drawing (1).dxf. Falls back once edited.
 */
function dxfFileName() {
  const ex = SCRIPT_EXAMPLES[Number(exampleSelect.value)];
  if (!ex || scriptEditor.value !== ex.script) return 'drawing.dxf';
  // Drop the leading "1. " and anything the filesystem would rather not see.
  const base = ex.name.replace(/^\d+\.\s*/, '').replace(/[\\/:*?"<>|]/g, '').trim();
  return `${base || 'drawing'}.dxf`;
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

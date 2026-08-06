/**
 * The 치수 설정 dialog — dimension appearance, stored between sessions.
 *
 * The values themselves and what they mean belong to dxf-generator.js, which is
 * the only thing that draws with them; this module is the form that edits them.
 * Every change applies straight away rather than waiting for an OK button, so
 * the drawing on screen answers the question "what does this do?" immediately.
 */

import { DIM_DEFAULTS, autoDimScale } from './dxf-generator.js';

// Versioned: the defaults changed to the house style (red, dots, DIMSCALE 100),
// and a settings entry saved under the old ones would hide them for anyone who
// had already opened the dialog once.
const STORAGE_KEY = 'esc_dwg.dimSettings.v2';

/**
 * The AutoCAD Color Index entries worth offering, with the RGB each one shows
 * as. 256 is BYLAYER — no colour of its own, which is the default and what
 * every drawing used before this dialog existed.
 */
const COLORS = [
  { aci: 256, label: 'BYLAYER', rgb: null },
  { aci: 1, label: '빨강', rgb: '#ff0000' },
  { aci: 2, label: '노랑', rgb: '#ffff00' },
  { aci: 3, label: '초록', rgb: '#00ff00' },
  { aci: 4, label: '하늘', rgb: '#00ffff' },
  { aci: 5, label: '파랑', rgb: '#0000ff' },
  { aci: 6, label: '자주', rgb: '#ff00ff' },
  { aci: 7, label: '흰색/검정', rgb: '#ffffff' },
  { aci: 8, label: '진회색', rgb: '#808080' },
  { aci: 9, label: '연회색', rgb: '#c0c0c0' },
];

/** Numeric fields, paired with the setting each one edits. */
const NUMBER_FIELDS = [
  ['dim-arrow-size', 'arrowSize'],
  ['dim-ext-offset', 'extOffset'],
  ['dim-ext-beyond', 'extBeyond'],
  ['dim-text-height', 'textHeight'],
];

/** Read the saved settings, falling back to the defaults for anything missing. */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DIM_DEFAULTS };
    // Only keys we know about: a stale or hand-edited entry must not smuggle
    // anything into the DXF writer.
    const saved = JSON.parse(raw);
    const out = { ...DIM_DEFAULTS };
    for (const key of Object.keys(DIM_DEFAULTS)) {
      if (saved[key] !== undefined) out[key] = saved[key];
    }
    return out;
  } catch {
    // Private-mode storage, or something wrote nonsense there.
    return { ...DIM_DEFAULTS };
  }
}

function save(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not being able to remember the choice is not worth interrupting anyone.
  }
}

/**
 * Wire up the dialog.
 *
 * @param {object} opts
 * @param {() => object[]} opts.getEntities  parsed entities, for the auto scale readout
 * @param {() => void} opts.onChange         called after every applied change
 * @returns {{ get: () => object }}          current settings, for generateDxf
 */
export function initDimSettings({ getEntities, onChange }) {
  let settings = load();

  const btn = document.getElementById('dim-settings-btn');
  const overlay = document.getElementById('dim-overlay');
  const arrowSel = document.getElementById('dim-arrow');
  const scaleInput = document.getElementById('dim-scale');
  const autoBox = document.getElementById('dim-scale-auto');
  const scaleNote = document.getElementById('dim-scale-note');
  // ── Colour swatches ───────────────────────────────────────────────────────
  /** Fill a swatch row that edits one colour setting. */
  function buildSwatches(id, key) {
    const row = document.getElementById(id);
    for (const c of COLORS) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = c.rgb ? 'dim-swatch' : 'dim-swatch bylayer';
      el.dataset.aci = String(c.aci);
      el.title = `${c.label} (${c.aci})`;
      if (c.rgb) el.style.background = c.rgb;
      else el.textContent = 'BYLAYER';
      el.addEventListener('click', () => {
        settings[key] = c.aci;
        apply();
      });
      row.appendChild(el);
    }
    return { row, key };
  }

  const swatchRows = [
    buildSwatches('dim-color', 'color'),
    buildSwatches('dim-text-color', 'textColor'),
  ];

  /** Push `settings` into the form controls. */
  function render() {
    for (const [id, key] of NUMBER_FIELDS) {
      document.getElementById(id).value = String(settings[key]);
    }
    arrowSel.value = settings.arrow;

    const auto = settings.scale === 'auto';
    autoBox.checked = auto;
    scaleInput.disabled = auto;
    // Auto mode still shows a number, so switching to manual starts from what
    // the drawing is actually using rather than from an empty box.
    const autoScale = autoDimScale(getEntities());
    scaleInput.value = String(auto ? round(autoScale) : settings.scale);
    scaleNote.textContent = auto ? `현재 도면 기준 ${round(autoScale)}` : 'DIMSCALE';

    for (const { row, key } of swatchRows) {
      for (const el of row.children) {
        el.classList.toggle('selected', Number(el.dataset.aci) === settings[key]);
      }
    }
  }

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  /** Save, redraw the form, and redraw the drawing. */
  function apply() {
    save(settings);
    render();
    onChange();
  }

  // ── Field wiring ──────────────────────────────────────────────────────────
  for (const [id, key] of NUMBER_FIELDS) {
    document.getElementById(id).addEventListener('change', (e) => {
      const v = Number(e.target.value);
      // A blank or negative box means the user is mid-edit, not that they want
      // a dimension of size NaN.
      if (!Number.isFinite(v) || v < 0) {
        render();
        return;
      }
      settings[key] = v;
      apply();
    });
  }

  arrowSel.addEventListener('change', () => {
    settings.arrow = arrowSel.value;
    apply();
  });

  autoBox.addEventListener('change', () => {
    settings.scale = autoBox.checked ? 'auto' : Number(scaleInput.value) || 1;
    apply();
  });

  scaleInput.addEventListener('change', () => {
    const v = Number(scaleInput.value);
    if (!Number.isFinite(v) || v <= 0) {
      render();
      return;
    }
    settings.scale = v;
    apply();
  });

  document.getElementById('dim-reset').addEventListener('click', () => {
    settings = { ...DIM_DEFAULTS };
    apply();
  });

  // ── Open / close ──────────────────────────────────────────────────────────
  function setVisible(visible) {
    overlay.classList.toggle('visible', visible);
    btn.classList.toggle('active', visible);
    if (visible) render();   // the auto scale readout depends on the drawing
  }

  btn.addEventListener('click', () => setVisible(!overlay.classList.contains('visible')));
  document.getElementById('dim-close').addEventListener('click', () => setVisible(false));
  // Clicking the backdrop closes; clicking inside the dialog must not.
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) setVisible(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setVisible(false);
  });

  render();

  return { get: () => settings };
}

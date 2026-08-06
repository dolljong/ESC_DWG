/**
 * "점 이름" overlay — a red dot and its name at every point the script defines.
 *
 * Drawn as HTML on top of the viewer canvas rather than as DXF entities, for
 * three reasons: the markers stay the same size however far you zoom, they
 * never end up in a saved DXF, and toggling them costs no reload.
 *
 * Placement follows the viewer's orthographic camera. Scene coordinates are
 * drawing coordinates minus the scene origin (DxfViewer keeps the origin near
 * the geometry so float precision holds up far from 0,0), and the camera's
 * half-width in scene units is (right - left) / (2 * zoom) — the same mapping
 * the viewer's own _CanvasToSceneCoord inverts.
 */

/** Only redraw markers this far outside the canvas; the rest are hidden. */
const CULL_MARGIN = 40;

/**
 * @param {import('dxf-viewer').DxfViewer} viewer
 * @param {HTMLElement} container  the viewer's DOM container (position: relative)
 */
export function createPointOverlay(viewer, container) {
  const root = document.createElement('div');
  root.id = 'point-overlay';
  container.appendChild(root);

  /** @type {{name:string, x:number, y:number}[]} */
  let points = [];
  /** @type {HTMLElement[]} — one per point, index-aligned with `points`. */
  let markers = [];
  let visible = false;
  /** Points changed while hidden — rebuild on the way back to visible. */
  let stale = false;

  /** Rebuild the marker elements to match `points`. */
  function rebuild() {
    root.replaceChildren();
    markers = points.map((p) => {
      const el = document.createElement('div');
      el.className = 'point-marker';
      const dot = document.createElement('span');
      dot.className = 'point-dot';
      const label = document.createElement('span');
      label.className = 'point-label';
      // textContent, not innerHTML: names come straight from the editor.
      label.textContent = p.name;
      el.append(dot, label);
      root.appendChild(el);
      return el;
    });
  }

  /** Move every marker to where its point currently sits on screen. */
  function place() {
    if (!visible || markers.length === 0) return;
    const canvas = viewer.GetCanvas();
    const cam = viewer.GetCamera();
    if (!canvas || !cam) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    // Half-extents of the visible area, in scene units.
    const halfW = (cam.right - cam.left) / (2 * cam.zoom);
    const halfH = (cam.top - cam.bottom) / (2 * cam.zoom);
    if (!(halfW > 0 && halfH > 0)) return;

    // Origin is null until the first successful load.
    const origin = viewer.GetOrigin() ?? { x: 0, y: 0 };

    for (let i = 0; i < markers.length; i++) {
      const p = points[i];
      const px = (((p.x - origin.x - cam.position.x) / halfW) + 1) / 2 * w;
      const py = (1 - ((p.y - origin.y - cam.position.y) / halfH)) / 2 * h;
      const el = markers[i];
      const onScreen =
        px >= -CULL_MARGIN && px <= w + CULL_MARGIN &&
        py >= -CULL_MARGIN && py <= h + CULL_MARGIN;
      el.style.display = onScreen ? 'block' : 'none';
      if (onScreen) el.style.transform = `translate(${px}px, ${py}px)`;
    }
  }

  // Every way the view can move. "loaded" matters because the viewer fits the
  // new drawing after loading it, which moves the camera without a pointer event.
  for (const ev of ['viewChanged', 'resized', 'loaded', 'cleared']) {
    viewer.Subscribe(ev, place);
  }

  return {
    /** @param {{name:string, x:number, y:number}[]} next */
    setPoints(next) {
      points = next ?? [];
      // Every run and every keystroke lands here; building markers nobody is
      // looking at is the one cost worth avoiding.
      if (!visible) {
        stale = true;
        return;
      }
      rebuild();
      place();
    },
    setVisible(on) {
      visible = on;
      root.classList.toggle('visible', on);
      if (on && stale) {
        stale = false;
        rebuild();
      }
      place();
    },
    isVisible: () => visible,
    /** Number of points currently labelled, for the status line. */
    count: () => points.length,
  };
}

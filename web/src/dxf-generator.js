/**
 * DXF generator — converts EntityDef[] from script-parser into a DXF string
 * using @tarikjabiri/dxf.
 */
import {
  DxfWriter,
  point3d,
  point2d,
  LWPolylineFlags,
  TextHorizontalAlignment,
  TextVerticalAlignment,
} from '@tarikjabiri/dxf';

// ─── Alignment mapping ─────────────────────────────────────────────────────
const H_ALIGN = {
  left:   TextHorizontalAlignment.Left,
  center: TextHorizontalAlignment.Center,
  right:  TextHorizontalAlignment.Right,
};

const V_ALIGN = {
  bottom:   TextVerticalAlignment.Bottom,
  middle:   TextVerticalAlignment.Middle,
  top:      TextVerticalAlignment.Top,
  baseline: TextVerticalAlignment.BaseLine,
};

// ─── Dimension styling ─────────────────────────────────────────────────────

/**
 * Text height for a dimension, matching the desktop build: 4% of the measured
 * span, never below 1 unit. Sizing each dimension from what it measures keeps
 * annotation legible whether the drawing is 10 units wide or 100,000.
 */
function dimTextHeight(p1, p2) {
  const span = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  return Math.max(span * 0.04, 1);
}

/**
 * Name a DIMSTYLE providing `height`, creating it on first use.
 *
 * DXF has no per-entity text height on DIMENSION — size comes from the named
 * style — so per-dimension sizing means one style per distinct height. The
 * desktop build instead writes XDATA style overrides, which are not reachable
 * here: the writer's ExtendedData nests an extra list level that dxf-viewer's
 * parser rejects outright, dropping the whole override. Named styles are also
 * what a CAD user expects to find when they open the file.
 *
 * @param {DxfWriter} dxf
 * @param {Map<string, string>} cache  — height key → style name
 */
function dimStyleFor(dxf, cache, height) {
  const key = height.toFixed(4);
  const cached = cache.get(key);
  if (cached) return cached;

  const name = `ESC_DIM${cache.size + 1}`;
  const style = dxf.tables.addDimStyle(name);
  style.DIMTXT = height;         // text height
  style.DIMASZ = height * 0.6;   // arrowhead size — desktop uses this same ratio
  // The desktop build leaves these at their defaults, which are absolute sizes
  // and so vanish next to text scaled up for a large drawing. The ratios are
  // the ISO-25 defaults restated relative to text height.
  style.DIMEXE = height * 0.5;   // extension line overshoot past the dim line
  style.DIMEXO = height * 0.25;  // gap between the measured point and its ext line
  style.DIMGAP = height * 0.25;  // gap between the dim line and its text
  style.DIMDEC = 0;              // whole units; these drawings are in millimetres
  // Zero suppression off. With DIMDEC 0 there is no fractional part to trim, so
  // this only ever costs nothing — but leaving it unset is not safe: dxf-viewer
  // defaults DIMZIN to 8 and strips trailing zeros with an unescaped-dot regex,
  // which eats real digits. "2000" renders as "0" and "1500" as "1".
  style.DIMZIN = 0;

  cache.set(key, name);
  return name;
}

/**
 * Where the dimension line sits, as an absolute point the writer stores in
 * group code 10. The library's own `offset` option is not usable: for aligned
 * dimensions it places the line somewhere that is not even perpendicular to
 * the measured direction. Computing the anchor here also reproduces the
 * desktop offset conventions exactly.
 *
 * Both viewer and CAD project the measured points onto the dimension line, so
 * only the line's position matters, not where along it this point falls.
 */
function dimAnchor(ent) {
  const [x1, y1] = ent.p1;
  const [x2, y2] = ent.p2;
  switch (ent.type) {
    // Horizontal: offset moves the line up (+) or down (−) from the first point.
    case 'hdim':
      return point3d(0, y1 + ent.offset, 0);
    // Vertical: offset moves the line right (+) or left (−) from the first point.
    case 'ldim':
      return point3d(x1 + ent.offset, 0, 0);
    // Aligned: offset is the perpendicular distance from the p1→p2 line,
    // positive to its left (counter-clockwise).
    default: {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const nx = -(y2 - y1) / len;
      const ny = (x2 - x1) / len;
      return point3d(x1 + nx * ent.offset, y1 + ny * ent.offset, 0);
    }
  }
}

/**
 * Generate a DXF string from an array of entity definitions.
 * @param {object[]} entities  — output of parseScript().entities
 * @returns {string}           — DXF file content
 */
export function generateDxf(entities) {
  const dxf = new DxfWriter();
  const dimStyles = new Map();

  for (const ent of entities) {
    switch (ent.type) {
      case 'line':
        dxf.addLine(
          point3d(ent.start[0], ent.start[1], 0),
          point3d(ent.end[0], ent.end[1], 0),
        );
        break;

      case 'circle':
        dxf.addCircle(point3d(ent.center[0], ent.center[1], 0), ent.radius);
        break;

      case 'arc':
        dxf.addArc(
          point3d(ent.center[0], ent.center[1], 0),
          ent.radius,
          ent.startAngle,
          ent.endAngle,
        );
        break;

      case 'rect': {
        const [x1, y1] = ent.p1;
        const [x2, y2] = ent.p2;
        dxf.addLWPolyline(
          [
            { point: point2d(x1, y1) },
            { point: point2d(x2, y1) },
            { point: point2d(x2, y2) },
            { point: point2d(x1, y2) },
          ],
          { flags: LWPolylineFlags.Closed },
        );
        break;
      }

      case 'polyline':
        dxf.addLWPolyline(
          ent.points.map(([x, y]) => ({ point: point2d(x, y) })),
        );
        break;

      case 'donut': {
        const [cx, cy] = ent.center;
        const w = (ent.outerD - ent.innerD) / 2;
        const avgR = (ent.innerD + ent.outerD) / 4;
        dxf.addLWPolyline(
          [
            { point: point2d(cx - avgR, cy), startingWidth: w, endWidth: w, bulge: 1 },
            { point: point2d(cx + avgR, cy), startingWidth: w, endWidth: w, bulge: 1 },
          ],
          { flags: LWPolylineFlags.Closed },
        );
        break;
      }

      case 'solid': {
        const pts = ent.points;
        const p4 = pts.length === 4 ? pts[3] : pts[2]; // repeat 3rd for triangle
        dxf.add3dFace(
          point3d(pts[0][0], pts[0][1], 0),
          point3d(pts[1][0], pts[1][1], 0),
          point3d(pts[2][0], pts[2][1], 0),
          point3d(p4[0], p4[1], 0),
        );
        break;
      }

      case 'text': {
        const hAlign = H_ALIGN[ent.align.h] ?? TextHorizontalAlignment.Left;
        const vAlign = V_ALIGN[ent.align.v] ?? TextVerticalAlignment.BaseLine;
        const pos = point3d(ent.position[0], ent.position[1], 0);
        const opts = {
          horizontalAlignment: hAlign,
          verticalAlignment: vAlign,
        };
        // When alignment is not default (left/baseline), DXF requires secondAlignmentPoint
        if (hAlign !== TextHorizontalAlignment.Left || vAlign !== TextVerticalAlignment.BaseLine) {
          opts.secondAlignmentPoint = pos;
        }
        dxf.addText(pos, ent.height, ent.content, opts);
        break;
      }

      case 'hdim':
      case 'ldim':
      case 'adim': {
        const opts = {
          styleName: dimStyleFor(dxf, dimStyles, dimTextHeight(ent.p1, ent.p2)),
          definitionPoint: dimAnchor(ent),
        };
        const first  = point3d(ent.p1[0], ent.p1[1], 0);
        const second = point3d(ent.p2[0], ent.p2[1], 0);

        if (ent.type === 'adim') {
          dxf.addAlignedDim(first, second, opts);
        } else {
          // A rotated linear dimension measures along `angle`, so the viewer
          // and CAD both report the projected length rather than the slope
          // distance — which is what hdim/ldim mean.
          dxf.addLinearDim(first, second, { ...opts, angle: ent.type === 'hdim' ? 0 : 90 });
        }
        break;
      }
    }
  }

  return dxf.stringify();
}

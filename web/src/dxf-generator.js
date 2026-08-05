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

/** Facets around a donut. Smooth enough that a rebar dot reads as a circle. */
const DONUT_SEGMENTS = 32;

/**
 * Emit one filled triangle as a 3DFACE.
 *
 * Always three corners, never four: dxf-viewer's 3DFACE parser walks the
 * vertex group codes and returns early the moment it meets a non-vertex code,
 * dropping the vertex it was midway through building
 * (parser/entities/3dface.js, parse3dFaceVertices). Since this writer emits
 * group 70 straight after the corners, a four-corner face always arrives with
 * its fourth corner missing and renders as half of the intended quad. Two
 * three-corner faces sidestep that entirely.
 */
function addTriangle(dxf, a, b, c) {
  dxf.add3dFace(a, b, c, c);
}

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

/** Dimension text height as a fraction of the drawing's larger extent. */
const DIM_HEIGHT_RATIO = 0.025;

/** Corner points bounding an entity, enough to size the drawing. */
function* entityExtentPoints(ent) {
  switch (ent.type) {
    case 'line':
      yield ent.start;
      yield ent.end;
      break;
    case 'rect':
      yield ent.p1;
      yield ent.p2;
      break;
    case 'polyline':
    case 'solid':
      yield* ent.points;
      break;
    case 'circle':
    case 'arc':
      yield [ent.center[0] - ent.radius, ent.center[1] - ent.radius];
      yield [ent.center[0] + ent.radius, ent.center[1] + ent.radius];
      break;
    case 'donut':
      yield [ent.center[0] - ent.outerD / 2, ent.center[1] - ent.outerD / 2];
      yield [ent.center[0] + ent.outerD / 2, ent.center[1] + ent.outerD / 2];
      break;
    case 'text':
      yield ent.position;
      break;
    case 'hdim':
    case 'ldim':
    case 'adim':
      yield ent.p1;
      yield ent.p2;
      yield dimLinePoint(ent);   // the offset line reaches beyond the geometry
      break;
  }
}

/**
 * A single text height shared by every dimension in the drawing.
 *
 * Sizing each dimension from its own measured span — what the desktop build
 * does — makes a 300 mm wall thickness annotate at a twentieth of the size of
 * the 5 m height beside it, which reads as a mistake rather than as detail.
 * Deriving one height from the overall extents instead keeps a drawing legible
 * whether it spans 10 units or 100,000, and keeps every dimension consistent.
 */
function drawingDimHeight(entities) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ent of entities) {
    for (const [x, y] of entityExtentPoints(ent)) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const extent = Math.max(maxX - minX, maxY - minY);
  // Degenerate input (no entities, or all of them at one point) still needs a
  // height that produces visible text.
  return Number.isFinite(extent) && extent > 0
    ? Math.max(extent * DIM_HEIGHT_RATIO, 1)
    : 1;
}

/**
 * Create the one DIMSTYLE the drawing uses and return its name.
 *
 * DXF has no per-entity text height on DIMENSION — size comes from the named
 * style. The desktop build instead writes XDATA style overrides, which are not
 * reachable here: the writer's ExtendedData nests an extra list level that
 * dxf-viewer's parser rejects outright, dropping the whole override. A named
 * style is also what a CAD user expects to find when they open the file.
 *
 * @param {DxfWriter} dxf
 * @param {number} height
 */
function createDimStyle(dxf, height) {
  const name = 'ESC_DIM';
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

  return name;
}

/** Point the dimension line passes through, in drawing coordinates. */
function dimLinePoint(ent) {
  const [x1, y1] = ent.p1;
  const [x2, y2] = ent.p2;
  switch (ent.type) {
    // Horizontal: offset moves the line up (+) or down (−) from the first point.
    case 'hdim':
      return [x1, y1 + ent.offset];
    // Vertical: offset moves the line right (+) or left (−) from the first point.
    case 'ldim':
      return [x1 + ent.offset, y1];
    // Aligned: offset is the perpendicular distance from the p1→p2 line,
    // positive to its left (counter-clockwise).
    default: {
      const len = Math.hypot(x2 - x1, y2 - y1);
      return [x1 - ((y2 - y1) / len) * ent.offset, y1 + ((x2 - x1) / len) * ent.offset];
    }
  }
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
  const [x, y] = dimLinePoint(ent);
  // Only the axis the offset acts along carries meaning for hdim/ldim; the
  // other is left at zero so it cannot drag the line off the measured points.
  if (ent.type === 'hdim') return point3d(0, y, 0);
  if (ent.type === 'ldim') return point3d(x, 0, 0);
  return point3d(x, y, 0);
}

/**
 * Generate a DXF string from an array of entity definitions.
 *
 * @param {object[]} entities  — output of parseScript().entities
 * @param {object} [options]
 * @param {boolean} [options.forCad]
 *   Write filled shapes as the entities a CAD user expects to edit — a real
 *   DONUT, one four-corner face per `solid` — instead of the triangle soup the
 *   viewer needs. Set this for a file the user downloads; leave it off for
 *   anything handed straight back to the viewer, which draws neither.
 * @returns {string}           — DXF file content
 */
export function generateDxf(entities, { forCad = false } = {}) {
  const dxf = new DxfWriter();
  // One style for the whole drawing, created only if something needs it.
  const dimHeight = drawingDimHeight(entities);
  let dimStyle = null;

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
        const rOuter = ent.outerD / 2;
        const rInner = ent.innerD / 2;

        if (forCad) {
          // The real thing: one closed two-vertex polyline whose bulge makes it
          // round and whose width fills it. Editable as a donut in CAD.
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

        // dxf-viewer drops the bulge of any segment that has a width
        // (DxfScene._GenerateShapedPolyline is a stub) and skips solid hatches
        // outright, so both CAD-native ways to express a filled ring render as
        // a bare straight line through the centre. Triangles are the one
        // filled primitive it does draw, so tessellate the ring instead.
        const at = (r, a) => point3d(cx + r * Math.cos(a), cy + r * Math.sin(a), 0);
        for (let i = 0; i < DONUT_SEGMENTS; i++) {
          const a0 = (2 * Math.PI * i) / DONUT_SEGMENTS;
          const a1 = (2 * Math.PI * (i + 1)) / DONUT_SEGMENTS;
          // A solid dot (innerD = 0) collapses the inner edge onto the centre,
          // so the second triangle degenerates away — exactly what is wanted.
          addTriangle(dxf, at(rInner, a0), at(rOuter, a0), at(rInner, a1));
          addTriangle(dxf, at(rOuter, a0), at(rOuter, a1), at(rInner, a1));
        }
        break;
      }

      case 'solid': {
        const pts = ent.points.map(([x, y]) => point3d(x, y, 0));
        // Four-point face order is the DXF "bowtie": point 4 is diagonal to
        // point 3, so the quad runs 1 → 2 → 4 → 3 and splits on the 2–3 edge.
        if (forCad) {
          // One face, as authored. dxf-viewer would lose its fourth corner (see
          // addTriangle) but CAD reads it correctly.
          dxf.add3dFace(pts[0], pts[1], pts[2], pts[3] ?? pts[2]);
          break;
        }
        addTriangle(dxf, pts[0], pts[1], pts[2]);
        if (pts.length === 4) addTriangle(dxf, pts[1], pts[3], pts[2]);
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
        if (dimStyle === null) dimStyle = createDimStyle(dxf, dimHeight);
        const opts = { styleName: dimStyle, definitionPoint: dimAnchor(ent) };
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

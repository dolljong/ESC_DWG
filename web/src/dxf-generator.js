/**
 * DXF generator — converts EntityDef[] from script-parser into a DXF string
 * using @tarikjabiri/dxf.
 */
import {
  DxfWriter,
  point3d,
  point2d,
  BlockFlags,
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
function addTriangle(dxf, a, b, c, options) {
  dxf.add3dFace(a, b, c, c, options);
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

/**
 * Dimension appearance, as the 치수선 설정 dialog stores it.
 *
 * Sizes are "paper" sizes in the CAD sense: what they mean on a printed sheet.
 * Every one of them is multiplied by `scale` (DIMSCALE) before it is drawn, so
 * one number resizes the whole annotation to suit the drawing.
 *
 * The values are the house style these drawings are dimensioned in: red, dots
 * on the measured points, DIMSCALE 100. Setting `scale: 'auto'` instead derives
 * DIMSCALE from the drawing's own extents — see autoDimScale — which suits a
 * one-off sketch whose size is not known in advance.
 */
export const DIM_DEFAULTS = {
  scale: 100,           // DIMSCALE — 'auto' or a positive number
  textHeight: 2.5,      // DIMTXT
  arrow: 'dot',         // 'closed' (filled arrowhead) | 'dot' | 'tick' (oblique stroke) | 'none'
  arrowSize: 1,         // DIMASZ, or DIMTSZ for ticks
  extOffset: 10,        // DIMEXO — gap between the measured point and its extension line
  extBeyond: 2,         // DIMEXE — extension line overshoot past the dimension line
  color: 1,             // ACI colour index for the lines; 1 is red, 256 is BYLAYER
  textColor: 7,         // ACI colour for the measurement text; 7 is white/black
};

/** DIMGAP, the clearance around the text. Not worth a dialog row of its own. */
const DIM_GAP = 0.625;

/** ACI code meaning "take the layer's colour". */
const BYLAYER = 256;

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

/** Larger of the drawing's two extents, or 0 if there is nothing to measure. */
function drawingExtent(entities) {
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
  return Number.isFinite(extent) && extent > 0 ? extent : 0;
}

/**
 * DIMSCALE derived from the drawing's own size.
 *
 * Sizing each dimension from its own measured span — what the desktop build
 * does — makes a 300 mm wall thickness annotate at a twentieth of the size of
 * the 5 m height beside it, which reads as a mistake rather than as detail.
 * Deriving one scale from the overall extents instead keeps a drawing legible
 * whether it spans 10 units or 100,000, and keeps every dimension consistent.
 *
 * At the default text height this puts the text at 2.5% of the drawing, which
 * is what this project drew before any of it was adjustable.
 */
export function autoDimScale(entities) {
  const extent = drawingExtent(entities);
  // Degenerate input (no entities, or all of them at one point) still needs a
  // scale that produces visible text.
  return Math.max(extent * DIM_HEIGHT_RATIO, 1) / DIM_DEFAULTS.textHeight;
}

/**
 * Turn the dialog's settings into the absolute sizes this drawing is drawn at.
 *
 * @param {object[]} entities
 * @param {Partial<typeof DIM_DEFAULTS>} settings
 */
function resolveDimStyle(entities, settings) {
  const base = { ...DIM_DEFAULTS, ...settings };
  const scale = Number(base.scale) > 0 ? Number(base.scale) : autoDimScale(entities);
  return {
    base,
    scale,
    arrow: base.arrow,
    color: Number(base.color) || BYLAYER,
    textColor: Number(base.textColor) || BYLAYER,
    textHeight: base.textHeight * scale,
    arrowSize: base.arrowSize * scale,
    extOffset: base.extOffset * scale,
    extBeyond: base.extBeyond * scale,
    gap: DIM_GAP * scale,
  };
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
 * The style carries the paper sizes and DIMSCALE separately, the way CAD stores
 * them, so a user who restyles a dimension there gets back what we drew.
 *
 * @param {DxfWriter} dxf
 * @param {ReturnType<typeof resolveDimStyle>} st
 */
function createDimStyle(dxf, st) {
  const name = 'ESC_DIM';
  const style = dxf.tables.addDimStyle(name);
  const b = st.base;
  style.DIMSCALE = st.scale;
  style.DIMTXT = b.textHeight;
  // Arrowheads and oblique ticks are alternatives: a non-zero DIMTSZ is what
  // tells CAD to draw ticks, and it makes DIMASZ irrelevant. Dots are sized by
  // DIMASZ as well — the terminator shape itself is DIMBLK, which is not
  // written: the writer emits it into group 342, a hard pointer that wants a
  // block-record handle, so a name like "_DOT" there is a broken reference. The
  // drawn block below is what every reader shows, so the dot survives; only a
  // CAD user who restyles the dimension gets arrowheads back.
  style.DIMASZ = st.arrow === 'closed' || st.arrow === 'dot' ? b.arrowSize : 0;
  style.DIMTSZ = st.arrow === 'tick' ? b.arrowSize : 0;
  // Ticks are normally drawn with the dimension line running on past them.
  style.DIMDLE = st.arrow === 'tick' ? b.arrowSize : 0;
  style.DIMEXE = b.extBeyond;
  style.DIMEXO = b.extOffset;
  style.DIMGAP = DIM_GAP;
  style.DIMCLRD = st.color;      // dimension line
  style.DIMCLRE = st.color;      // extension lines
  style.DIMCLRT = st.textColor;  // text
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

/** Unit vector along the direction the dimension measures. */
function dimDirection(ent) {
  if (ent.type === 'hdim') return [1, 0];
  if (ent.type === 'ldim') return [0, 1];
  const [x1, y1] = ent.p1;
  const [x2, y2] = ent.p2;
  const len = Math.hypot(x2 - x1, y2 - y1);
  return [(x2 - x1) / len, (y2 - y1) / len];
}

/**
 * Everything needed to both describe and draw one dimension.
 *
 * `d1`/`d2` are the measured points projected onto the dimension line, which is
 * where the arrowheads land. `normal` points to the side the text sits on:
 * above a horizontal dimension, left of a vertical one, whichever way round the
 * two points were given. That is the AutoCAD convention, and picking the
 * perpendicular with the larger y (ties going to −x) is how dxf-viewer picks it
 * too — worth matching, since preview and file must not disagree.
 */
function dimGeometry(ent, st) {
  const dir = dimDirection(ent);
  // The offset is perpendicular to `dir` in every case, so p1 projected onto
  // the dimension line is exactly the offset point.
  const d1 = dimLinePoint(ent);
  const span = (ent.p2[0] - ent.p1[0]) * dir[0] + (ent.p2[1] - ent.p1[1]) * dir[1];
  const d2 = [d1[0] + dir[0] * span, d1[1] + dir[1] * span];

  // Direction actually drawn, d1 → d2.
  const s = Math.sign(span) || 1;
  const v = [dir[0] * s, dir[1] * s];
  const normal = v[1] < -v[0] ? [v[1], -v[0]] : [-v[1], v[0]];

  const mid = [(d1[0] + d2[0]) / 2, (d1[1] + d2[1]) / 2];
  return {
    d1,
    d2,
    v,
    normal,
    length: Math.abs(span),
    // Direction the dimension measures along, for DXF group 50.
    angle: (Math.atan2(dir[1], dir[0]) * 180) / Math.PI,
    // Text sits clear of the dimension line by DIMGAP + half its own height.
    textMid: [
      mid[0] + normal[0] * (st.gap + st.textHeight / 2),
      mid[1] + normal[1] * (st.gap + st.textHeight / 2),
    ],
    // Reading direction along the dimension line: 0 for horizontal, 90 for vertical.
    textAngle: (Math.atan2(normal[1], normal[0]) * 180) / Math.PI - 90,
  };
}

/**
 * Where the dimension line sits, as an absolute point the writer stores in
 * group code 10. The library's own `offset` option is not usable: for aligned
 * dimensions it places the line somewhere that is not even perpendicular to
 * the measured direction. Computing the anchor here also reproduces the
 * desktop offset conventions exactly.
 *
 * Readers project the measured points onto the dimension line, so only the
 * line's position matters, not where along it this point falls — but it must be
 * a real point on that line. Writing a half-zeroed one (x taken from the offset,
 * y left at 0) is what CAD read as a dimension running off at an angle.
 */
function dimAnchor(geom) {
  return point3d(geom.d2[0], geom.d2[1], 0);
}

/** Measurement text, formatted the way DIMDEC 0 asks for: whole units. */
function dimText(geom) {
  return String(Math.round(geom.length));
}

/**
 * Draw the dimension into an anonymous block and return its name.
 *
 * A DIMENSION entity carries the measurement as definition points, but what a
 * CAD program *draws* is the block named in group 2 — every CAD writes one, and
 * a dimension without it is invalid enough that ezdxf's auditor deletes the
 * entity outright. Readers left to regenerate the geometry themselves disagree
 * about how, which is how a horizontal dimension ends up drawn at an angle.
 *
 * Same geometry the entity describes, so a CAD user can still stretch or
 * restyle the dimension and have it regenerate to match.
 */
function addDimBlock(dxf, ent, geom, st, index) {
  // Anonymous dimension blocks are *D1, *D2, … — addBlock() on the writer
  // strips the leading '*', so go through the blocks section directly.
  const block = dxf.blocks.addBlock(`*D${index}`, dxf.objects, false);
  block.flags = BlockFlags.AnonymousBlock;

  const { d1, d2, v, normal } = geom;
  const arrow = st.arrowSize;
  // Everything in the block carries the chosen colour, so the dimension keeps
  // it whether CAD draws the block or regenerates from the style. Text has its
  // own, the way DIMCLRT is separate from DIMCLRD/DIMCLRE.
  const opts = { colorNumber: st.color };
  const textOpts = { colorNumber: st.textColor };

  // Ticks are drawn on the line rather than inside it, so the line runs on past
  // them — DIMDLE. Arrowheads sit within the measured span and need no overrun.
  const overrun = st.arrow === 'tick' ? arrow : 0;
  block.addLine(
    point3d(d1[0] - v[0] * overrun, d1[1] - v[1] * overrun, 0),
    point3d(d2[0] + v[0] * overrun, d2[1] + v[1] * overrun, 0),
    opts,
  );

  // Extension lines: from just clear of the measured point to just past the
  // dimension line. Skipped when the dimension line passes through the point.
  const addExtLine = (from, to) => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy);
    if (len <= st.extOffset) return;
    const ux = dx / len;
    const uy = dy / len;
    block.addLine(
      point3d(from[0] + ux * st.extOffset, from[1] + uy * st.extOffset, 0),
      point3d(to[0] + ux * st.extBeyond, to[1] + uy * st.extBeyond, 0),
      opts,
    );
  };
  addExtLine(ent.p1, d1);
  addExtLine(ent.p2, d2);

  // Filled arrowheads, tip on the measured point. Too short a dimension has no
  // room for them between the extension lines, so they flip to the outside.
  const flip = geom.length < arrow * 2 ? -1 : 1;
  const addArrow = (tip, along) => {
    const bx = tip[0] + along[0] * arrow * flip;
    const by = tip[1] + along[1] * arrow * flip;
    const hx = normal[0] * arrow * 0.25;
    const hy = normal[1] * arrow * 0.25;
    addTriangle(
      block,
      point3d(tip[0], tip[1], 0),
      point3d(bx - hx, by - hy, 0),
      point3d(bx + hx, by + hy, 0),
      opts,
    );
  };

  // An oblique stroke through the point, at 45° between the dimension line and
  // its normal — the architectural tick.
  const addTick = (tip) => {
    const ux = (v[0] + normal[0]) / Math.SQRT2;
    const uy = (v[1] + normal[1]) / Math.SQRT2;
    block.addLine(
      point3d(tip[0] - ux * arrow, tip[1] - uy * arrow, 0),
      point3d(tip[0] + ux * arrow, tip[1] + uy * arrow, 0),
      opts,
    );
  };

  // A filled circle centred on the measured point, DIMASZ across — the CAD
  // "_DOT" terminator. Tessellated for the same reason the donut entity is:
  // dxf-viewer draws no filled circle, only triangles.
  const addDot = (tip) => {
    const r = arrow / 2;
    const at = (a) => point3d(tip[0] + r * Math.cos(a), tip[1] + r * Math.sin(a), 0);
    const centre = point3d(tip[0], tip[1], 0);
    for (let i = 0; i < DONUT_SEGMENTS; i++) {
      const a0 = (2 * Math.PI * i) / DONUT_SEGMENTS;
      const a1 = (2 * Math.PI * (i + 1)) / DONUT_SEGMENTS;
      addTriangle(block, centre, at(a0), at(a1), opts);
    }
  };

  if (st.arrow === 'closed') {
    addArrow(d1, v);
    addArrow(d2, [-v[0], -v[1]]);
  } else if (st.arrow === 'dot') {
    addDot(d1);
    addDot(d2);
  } else if (st.arrow === 'tick') {
    addTick(d1);
    addTick(d2);
  }

  const textPos = point3d(geom.textMid[0], geom.textMid[1], 0);
  block.addText(textPos, st.textHeight, dimText(geom), {
    ...textOpts,
    rotation: geom.textAngle,
    horizontalAlignment: TextHorizontalAlignment.Center,
    verticalAlignment: TextVerticalAlignment.Middle,
    secondAlignmentPoint: textPos,
  });

  return block.name;
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
 * @param {Partial<typeof DIM_DEFAULTS>} [options.dim]
 *   Dimension appearance from the 치수선 설정 dialog. Omitted keys fall back to
 *   DIM_DEFAULTS, so passing nothing draws what this project always drew.
 * @returns {string}           — DXF file content
 */
export function generateDxf(entities, { forCad = false, dim = {} } = {}) {
  const dxf = new DxfWriter();
  // One style for the whole drawing, created only if something needs it.
  const dimSizes = resolveDimStyle(entities, dim);
  let dimStyle = null;
  let dimCount = 0;

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
        if (dimStyle === null) dimStyle = createDimStyle(dxf, dimSizes);
        const geom = dimGeometry(ent, dimSizes);
        const opts = {
          styleName: dimStyle,
          colorNumber: dimSizes.color,
          definitionPoint: dimAnchor(geom),
          // Group 11. Required, and the position CAD draws the text at.
          middlePoint: point3d(geom.textMid[0], geom.textMid[1], 0),
          blockName: addDimBlock(dxf, ent, geom, dimSizes, ++dimCount),
        };
        const first  = point3d(ent.p1[0], ent.p1[1], 0);
        const second = point3d(ent.p2[0], ent.p2[1], 0);

        // All three are written as rotated linear dimensions, which measure
        // along `angle`: 0 and 90 give hdim and ldim their projected lengths,
        // and the p1→p2 direction gives adim the slope distance. An ALIGNED
        // dimension would say the same thing for adim, but it carries no angle,
        // so a reader has to infer the direction — ezdxf infers 0 and reports
        // the horizontal projection. Writing the angle leaves nothing to infer,
        // and is what ezdxf's own aligned dimensions do.
        dxf.addLinearDim(first, second, { ...opts, angle: geom.angle });
        break;
      }
    }
  }

  return dxf.stringify();
}

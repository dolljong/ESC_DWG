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

/**
 * Generate a DXF string from an array of entity definitions.
 * @param {object[]} entities  — output of parseScript().entities
 * @returns {string}           — DXF file content
 */
export function generateDxf(entities) {
  const dxf = new DxfWriter();

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
    }
  }

  return dxf.stringify();
}

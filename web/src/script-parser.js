/**
 * Script parser — ports the Python ESC_DWG script editor logic to JavaScript.
 *
 * Input : multi-line script string
 * Output: { entities: EntityDef[], errors: {line, message}[] }
 */

import { Point, evaluate as safeEval } from './expression.js';

export { Point };

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Drop a trailing `# comment`, ignoring any '#' inside a quoted string.
 *
 * Models write `rect p1 p3   # top flange` no matter how firmly the spec says
 * comments must own their line, and rejecting that is pointless strictness.
 */
function stripComment(line) {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === '#' && !inQuote) return line.slice(0, i);
  }
  return line;
}

/** Split string by top-level commas (not inside parentheses). */
function splitCommaTop(s) {
  let depth = 0;
  const parts = [];
  let cur = [];
  for (const ch of s) {
    if (ch === '(') {
      depth++;
      cur.push(ch);
    } else if (ch === ')') {
      depth--;
      cur.push(ch);
    } else if (ch === ',' && depth === 0) {
      parts.push(cur.join(''));
      cur = [];
    } else {
      cur.push(ch);
    }
  }
  parts.push(cur.join(''));
  return parts;
}

/** Resolve a single point token → [x, y] */
function resolvePoint(token, variables) {
  token = token.trim();
  // Parenthesised form: (expr, expr)
  const m = token.match(/^\((.+)\)$/);
  if (m) {
    const parts = splitCommaTop(m[1]);
    if (parts.length === 2) {
      return [Number(safeEval(parts[0].trim(), variables)),
              Number(safeEval(parts[1].trim(), variables))];
    }
    throw new Error(`Expected 2 coordinates, got ${parts.length}: ${token}`);
  }
  // Named point
  const val = safeEval(token, variables);
  if (val instanceof Point) return [val.x, val.y];
  throw new Error(`Not a point: ${token}`);
}

/** Tokenise an argument string into point tokens. */
function parsePointArgs(argsStr, variables) {
  const tokens = [];
  let i = 0;
  const s = argsStr.trim();
  while (i < s.length) {
    if (s[i] === '(') {
      let depth = 1;
      let j = i + 1;
      while (j < s.length && depth > 0) {
        if (s[j] === '(') depth++;
        else if (s[j] === ')') depth--;
        j++;
      }
      tokens.push(s.slice(i, j));
      i = j;
    } else if (s[i] === ' ' || s[i] === '\t') {
      i++;
    } else {
      let j = i;
      while (j < s.length && s[j] !== ' ' && s[j] !== '\t' && s[j] !== '(') j++;
      tokens.push(s.slice(i, j));
      i = j;
    }
  }
  return tokens.map((t) => resolvePoint(t, variables));
}

/** Extract point-string + remaining tokens from a remainder string
 *  where the first argument is a point (name or parenthesised). */
function extractPointAndRest(remainder, variables) {
  remainder = remainder.trim();
  if (remainder.startsWith('(')) {
    let depth = 1;
    let j = 1;
    while (j < remainder.length && depth > 0) {
      if (remainder[j] === '(') depth++;
      else if (remainder[j] === ')') depth--;
      j++;
    }
    const ptStr = remainder.slice(0, j);
    const rest = remainder.slice(j).trim().split(/\s+/);
    return { point: resolvePoint(ptStr, variables), rest };
  }
  const parts = remainder.split(/\s+/);
  const point = resolvePoint(parts[0], variables);
  return { point, rest: parts.slice(1) };
}

// ─── Entity keywords ───────────────────────────────────────────────────────
const ENTITY_KEYWORDS = new Set([
  'line', 'circle', 'arc', 'rect', 'polyline', 'pline',
  'solid', 'donut', 'text', 'hdim', 'ldim', 'adim',
]);

// ─── Text alignment map ────────────────────────────────────────────────────
const ALIGN_MAP = {
  LB: { h: 'left',   v: 'bottom' },
  CB: { h: 'center', v: 'bottom' },
  RB: { h: 'right',  v: 'bottom' },
  LM: { h: 'left',   v: 'middle' },
  CM: { h: 'center', v: 'middle' },
  RM: { h: 'right',  v: 'middle' },
  LT: { h: 'left',   v: 'top' },
  CT: { h: 'center', v: 'top' },
  RT: { h: 'right',  v: 'top' },
  L:  { h: 'left',   v: 'bottom' },
  C:  { h: 'center', v: 'bottom' },
  R:  { h: 'right',  v: 'bottom' },
};
const ALIGN_KEYS_RE = Object.keys(ALIGN_MAP)
  .sort((a, b) => b.length - a.length)
  .join('|');

// ─── Main parser ────────────────────────────────────────────────────────────

/**
 * Parse a script string and return intermediate entity definitions + errors.
 * @param {string} script
 * @returns {{ entities: object[], errors: {line:number, message:string}[] }}
 */
export function parseScript(script) {
  // Null prototype: a name like `toString` must not resolve to anything.
  const variables = Object.create(null);
  const entities = [];
  const errors = [];

  const lines = script.split('\n');
  for (let idx = 0; idx < lines.length; idx++) {
    const lineNo = idx + 1;
    const line = stripComment(lines[idx]).trim();
    if (!line) continue;

    try {
      const cmdWord = line.split(/\s+/)[0].toLowerCase();

      // ── line ──────────────────────────────────────────────
      if (cmdWord === 'line') {
        const pts = parsePointArgs(line.slice(4), variables);
        if (pts.length < 2) throw new Error(`line expects at least 2 points, got ${pts.length}`);
        for (let i = 0; i < pts.length - 1; i++) {
          entities.push({ type: 'line', start: pts[i], end: pts[i + 1] });
        }
        continue;
      }

      // ── circle ────────────────────────────────────────────
      if (cmdWord === 'circle') {
        const { point: center, rest } = extractPointAndRest(line.slice(6), variables);
        const radius = Number(safeEval(rest.join(' '), variables));
        entities.push({ type: 'circle', center, radius });
        continue;
      }

      // ── arc ───────────────────────────────────────────────
      if (cmdWord === 'arc') {
        const { point: center, rest } = extractPointAndRest(line.slice(3), variables);
        if (rest.length !== 3) throw new Error('arc expects: arc <pt> <radius> <startAngle> <endAngle>');
        const radius = Number(safeEval(rest[0], variables));
        const sa = Number(safeEval(rest[1], variables));
        const ea = Number(safeEval(rest[2], variables));
        entities.push({ type: 'arc', center, radius, startAngle: sa, endAngle: ea });
        continue;
      }

      // ── rect ──────────────────────────────────────────────
      if (cmdWord === 'rect') {
        const pts = parsePointArgs(line.slice(4), variables);
        if (pts.length !== 2) throw new Error(`rect expects 2 points, got ${pts.length}`);
        entities.push({ type: 'rect', p1: pts[0], p2: pts[1] });
        continue;
      }

      // ── polyline / pline ──────────────────────────────────
      if (cmdWord === 'polyline' || cmdWord === 'pline') {
        const pts = parsePointArgs(line.slice(cmdWord.length), variables);
        if (pts.length >= 2) {
          entities.push({ type: 'polyline', points: pts });
        }
        continue;
      }

      // ── donut ─────────────────────────────────────────────
      if (cmdWord === 'donut') {
        const { point: center, rest } = extractPointAndRest(line.slice(5), variables);
        if (rest.length !== 2) throw new Error('donut expects: donut <center> <innerDia> <outerDia>');
        const innerD = Number(safeEval(rest[0], variables));
        const outerD = Number(safeEval(rest[1], variables));
        if (outerD <= innerD) throw new Error('outer diameter must be greater than inner diameter');
        entities.push({ type: 'donut', center, innerD, outerD });
        continue;
      }

      // ── solid ─────────────────────────────────────────────
      if (cmdWord === 'solid') {
        const pts = parsePointArgs(line.slice(5), variables);
        if (pts.length !== 3 && pts.length !== 4) throw new Error(`solid expects 3 or 4 points, got ${pts.length}`);
        entities.push({ type: 'solid', points: pts });
        continue;
      }

      // ── text ──────────────────────────────────────────────
      if (cmdWord === 'text') {
        // With alignment: text <pt> AL height "content"
        const mAlign = line.match(
          new RegExp(`^text\\s+(.+?)\\s+(${ALIGN_KEYS_RE})\\s+(\\S+)\\s+"(.+?)"\\s*$`, 'i')
        );
        if (mAlign) {
          const pos = resolvePoint(mAlign[1], variables);
          const align = ALIGN_MAP[mAlign[2].toUpperCase()];
          const height = Number(safeEval(mAlign[3], variables));
          const content = mAlign[4];
          entities.push({ type: 'text', position: pos, height, content, align });
          continue;
        }
        // Alignment given but height omitted — otherwise this falls through to
        // the no-align form and reports a baffling "Unknown name: CM".
        const mNoHeight = line.match(
          new RegExp(`^text\\s+(.+?)\\s+(${ALIGN_KEYS_RE})\\s+"(.+?)"\\s*$`, 'i')
        );
        if (mNoHeight) {
          throw new Error(
            `text is missing its height: text ${mNoHeight[1]} ${mNoHeight[2]} <height> "${mNoHeight[3]}"`
          );
        }

        // Without alignment: text <pt> height "content"
        const mPlain = line.match(/^text\s+(.+?)\s+(\S+)\s+"(.+?)"\s*$/i);
        if (mPlain) {
          const pos = resolvePoint(mPlain[1], variables);
          const height = Number(safeEval(mPlain[2], variables));
          const content = mPlain[3];
          entities.push({ type: 'text', position: pos, height, content, align: ALIGN_MAP.LB });
          continue;
        }
        throw new Error('text syntax: text <point> [LB|CB|RB|LM|CM|RM|LT|CT|RT|L|C|R] height "content"');
      }

      // ── dimension commands (unsupported in web) ───────────
      if (cmdWord === 'hdim' || cmdWord === 'ldim' || cmdWord === 'adim') {
        errors.push({ line: lineNo, message: `${cmdWord} is not supported in the web version` });
        continue;
      }

      // ── variable / point assignment ───────────────────────
      const mAssign = line.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
      if (mAssign) {
        const varName = mAssign[1];
        const exprStr = mAssign[2].trim();

        // Try point assignment (two comma-separated expressions)
        const parts = splitCommaTop(exprStr);
        if (parts.length === 2) {
          try {
            const px = Number(safeEval(parts[0].trim(), variables));
            const py = Number(safeEval(parts[1].trim(), variables));
            variables[varName] = new Point(px, py);
            continue;
          } catch {
            // fall through to scalar
          }
        }
        variables[varName] = safeEval(exprStr, variables);
        continue;
      }

      errors.push({ line: lineNo, message: `Unknown command: ${line}` });
    } catch (e) {
      errors.push({ line: lineNo, message: e.message });
    }
  }

  return { entities, errors };
}

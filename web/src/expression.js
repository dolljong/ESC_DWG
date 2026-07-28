/**
 * Expression evaluator for the ESC_DWG script language.
 *
 * This replaces a `new Function(...)` "sandbox" that was never a sandbox — a
 * function body reaches every global through the scope chain. That was
 * tolerable while scripts were typed by the person running them. It is not
 * tolerable now: scripts are written by a language model and run in a
 * visitor's browser alongside their stored OpenRouter key, so a prompt
 * injection or a bad generation could exfiltrate someone else's credential.
 *
 * The language understood here is arithmetic over numbers and points, and
 * nothing else. There is no path to globals, no property access beyond .x and
 * .y, no strings, no indexing, no assignment, and only whitelisted functions.
 */

// ─── Point ──────────────────────────────────────────────────────────────────
export class Point {
  constructor(x, y) {
    this.x = Number(x)
    this.y = Number(y)
  }
  toString() {
    return `Point(${this.x}, ${this.y})`
  }
}

// ─── Whitelisted names ──────────────────────────────────────────────────────
const CONSTANTS = { pi: Math.PI }

const FUNCTIONS = {
  abs: Math.abs,
  round: Math.round,
  min: Math.min,
  max: Math.max,
  int: Math.trunc,
  float: Number,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,
  sqrt: Math.sqrt,
  hypot: Math.hypot,
  ceil: Math.ceil,
  floor: Math.floor,
  radians: (d) => (d * Math.PI) / 180,
  degrees: (r) => (r * 180) / Math.PI,
  Point: (x, y) => new Point(x, y),
}

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

/** Coerce to a number, refusing points and anything unexpected. */
function num(v) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('Result is not a finite number')
    return v
  }
  if (v instanceof Point) throw new Error('A point is not a number — use .x or .y')
  throw new Error(`Not a number: ${v}`)
}

// ─── Tokenizer ──────────────────────────────────────────────────────────────
const DIGIT = /\d/
const IDENT_START = /[A-Za-z_]/
const IDENT_PART = /\w/
const SYMBOLS = '+-*/%(),.'

function tokenize(src) {
  const tokens = []
  let i = 0

  while (i < src.length) {
    const c = src[i]

    if (c === ' ' || c === '\t') {
      i++
      continue
    }

    // Number, including a leading-dot form like .5
    if (DIGIT.test(c) || (c === '.' && DIGIT.test(src[i + 1] ?? ''))) {
      let j = i
      while (j < src.length && /[\d.]/.test(src[j])) j++
      if (src[j] === 'e' || src[j] === 'E') {
        let k = j + 1
        if (src[k] === '+' || src[k] === '-') k++
        if (DIGIT.test(src[k] ?? '')) {
          while (k < src.length && DIGIT.test(src[k])) k++
          j = k
        }
      }
      const text = src.slice(i, j)
      const value = Number(text)
      if (!Number.isFinite(value)) throw new Error(`Invalid number: ${text}`)
      tokens.push({ type: 'num', value })
      i = j
      continue
    }

    if (IDENT_START.test(c)) {
      let j = i
      while (j < src.length && IDENT_PART.test(src[j])) j++
      tokens.push({ type: 'name', value: src.slice(i, j) })
      i = j
      continue
    }

    if (src.startsWith('**', i)) {
      tokens.push({ type: 'op', value: '**' })
      i += 2
      continue
    }

    if (SYMBOLS.includes(c)) {
      tokens.push({ type: 'op', value: c })
      i++
      continue
    }

    throw new Error(`Unexpected character '${c}'`)
  }

  return tokens
}

// ─── Recursive-descent evaluator ────────────────────────────────────────────
class Evaluator {
  constructor(tokens, scope) {
    this.tokens = tokens
    this.pos = 0
    this.scope = scope
  }

  peek() {
    return this.tokens[this.pos]
  }

  next() {
    return this.tokens[this.pos++]
  }

  isOp(value) {
    const t = this.peek()
    return t !== undefined && t.type === 'op' && t.value === value
  }

  expectOp(value) {
    if (!this.isOp(value)) {
      const t = this.peek()
      throw new Error(`Expected '${value}' but found ${t ? `'${t.value}'` : 'end of expression'}`)
    }
    this.pos++
  }

  // additive := multiplicative (('+' | '-') multiplicative)*
  parseExpression() {
    let left = this.parseMultiplicative()
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().value
      const right = num(this.parseMultiplicative())
      left = op === '+' ? num(left) + right : num(left) - right
    }
    return left
  }

  // multiplicative := unary (('*' | '/' | '%') unary)*
  parseMultiplicative() {
    let left = this.parseUnary()
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const op = this.next().value
      const right = num(this.parseUnary())
      const l = num(left)
      if ((op === '/' || op === '%') && right === 0) throw new Error('Division by zero')
      left = op === '*' ? l * right : op === '/' ? l / right : l % right
    }
    return left
  }

  // unary := ('-' | '+') unary | power
  parseUnary() {
    if (this.isOp('-') || this.isOp('+')) {
      const op = this.next().value
      const v = num(this.parseUnary())
      return op === '-' ? -v : v
    }
    return this.parsePower()
  }

  // power := postfix ('**' unary)?   — right-associative, as in JS
  parsePower() {
    const base = this.parsePostfix()
    if (this.isOp('**')) {
      this.next()
      return num(base) ** num(this.parseUnary())
    }
    return base
  }

  // postfix := primary ('.' ('x' | 'y'))*
  parsePostfix() {
    let value = this.parsePrimary()
    while (this.isOp('.')) {
      this.next()
      const prop = this.next()
      if (!prop || prop.type !== 'name') throw new Error("Expected a property name after '.'")
      // The whitelist is the point of this function: no constructor, no
      // __proto__, no arbitrary traversal.
      if (prop.value !== 'x' && prop.value !== 'y') {
        throw new Error(`Unknown property '.${prop.value}' — only .x and .y exist`)
      }
      if (!(value instanceof Point)) {
        throw new Error(`'.${prop.value}' can only be used on a point`)
      }
      value = value[prop.value]
    }
    return value
  }

  // primary := NUMBER | '(' expression ')' | NAME | NAME '(' args ')'
  parsePrimary() {
    const t = this.next()
    if (!t) throw new Error('Unexpected end of expression')

    if (t.type === 'num') return t.value

    if (t.type === 'op' && t.value === '(') {
      const v = this.parseExpression()
      this.expectOp(')')
      return v
    }

    if (t.type === 'name') {
      if (this.isOp('(')) return this.parseCall(t.value)
      if (has(this.scope, t.value)) return this.scope[t.value]
      if (has(CONSTANTS, t.value)) return CONSTANTS[t.value]
      throw new Error(`Unknown name: ${t.value}`)
    }

    throw new Error(`Unexpected '${t.value}'`)
  }

  parseCall(name) {
    this.expectOp('(')
    const args = []
    if (!this.isOp(')')) {
      for (;;) {
        args.push(this.parseExpression())
        if (this.isOp(',')) {
          this.next()
          continue
        }
        break
      }
    }
    this.expectOp(')')

    // Only whitelisted functions are callable — never a value from scope.
    if (!has(FUNCTIONS, name)) throw new Error(`Unknown function: ${name}()`)
    return FUNCTIONS[name](...args.map(num))
  }
}

/**
 * Evaluate a single expression.
 *
 * @param {string} expr
 * @param {object} scope  variables by name; values are numbers or Points
 * @returns {number|Point}
 */
export function evaluate(expr, scope = {}) {
  const src = String(expr).trim()
  if (!src) throw new Error('Empty expression')

  const tokens = tokenize(src)
  const ev = new Evaluator(tokens, scope)
  const value = ev.parseExpression()

  if (ev.pos < tokens.length) {
    throw new Error(`Unexpected '${tokens[ev.pos].value}' after end of expression`)
  }
  return value
}

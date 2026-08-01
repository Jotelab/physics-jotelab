/**
 * Free-form value entry for the coach (C1.2 limitation "structured input only").
 *
 * The three answer boxes used to accept a bare decimal or a simple fraction.
 * That kept grading trivially safe, but it also meant the app never saw how a
 * student actually works: someone who writes `20*4/2` in the box was told their
 * input was not an answer, and someone who typed the unit alongside the number
 * was too. This widens what a student may *type* without widening what the app
 * *trusts* — the value is still graded against the engine's `sympy_data`, and
 * the classifier is unchanged.
 *
 * Deliberately **not** here: free-form Thai working ("แทนค่าลงในสมการ v = u + at
 * ได้ 5 + 2×3"). Parsing prose reliably is a much larger problem with much worse
 * failure modes, and the honest thing is to leave it as a stated limitation
 * rather than ship a parser that silently misreads a student's answer.
 *
 * **This evaluates text a student typed, so it uses a hand-written recursive
 * descent parser — never `eval`, `Function`, or a regex-and-hope.** Anything the
 * grammar does not recognise returns `null`, which the UI treats as "not
 * answered yet", never as a wrong answer.
 */

/** Bound on input length — a student's answer is short; anything longer is not one. */
const MAX_INPUT_LENGTH = 120

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙"

/** Normalize the characters students actually type into a canonical form. */
function normalize(raw: string): string {
  let text = raw.trim()

  // Thai numerals → Arabic.
  text = text.replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)))

  // Multiplication and division symbols.
  text = text.replace(/[×∙·]/g, "*").replace(/[÷]/g, "/")

  // Thousands separators between digits (1,250 → 1250), not decimal commas.
  text = text.replace(/(\d),(\d{3})\b/g, "$1$2")

  // A trailing unit: anything after the mathematical part. Units are Latin
  // letters, Thai letters, `/`, `^` and digits — but stripping blindly would eat
  // a division, so only strip a unit that follows whitespace and starts with a
  // letter.
  text = text.replace(/\s+[A-Za-z฀-๿][A-Za-z฀-๿/^0-9]*$/u, "")

  return text.trim()
}

type Parser = { text: string; pos: number }

function peek(p: Parser): string {
  return p.text[p.pos] ?? ""
}

function skipSpace(p: Parser): void {
  while (p.pos < p.text.length && p.text[p.pos] === " ") p.pos += 1
}

/** number | '(' expr ')' | '-' factor */
function parseUnary(p: Parser): number | null {
  skipSpace(p)
  const char = peek(p)

  if (char === "-" || char === "+") {
    p.pos += 1
    const value = parseUnary(p)
    return value === null ? null : char === "-" ? -value : value
  }

  if (char === "(") {
    p.pos += 1
    const value = parseExpression(p)
    if (value === null) return null
    skipSpace(p)
    if (peek(p) !== ")") return null
    p.pos += 1
    return value
  }

  // A literal: digits with an optional fraction part and optional exponent.
  const match = /^\d+(\.\d+)?([eE][-+]?\d+)?/.exec(p.text.slice(p.pos))
  if (!match) return null
  p.pos += match[0].length
  const value = Number(match[0])
  return Number.isFinite(value) ? value : null
}

/** unary ('^' unary)*  — right-associative, so 2^3^2 is 2^(3^2). */
function parsePower(p: Parser): number | null {
  const base = parseUnary(p)
  if (base === null) return null
  skipSpace(p)
  if (peek(p) !== "^") return base
  p.pos += 1
  const exponent = parsePower(p)
  if (exponent === null) return null
  const value = base ** exponent
  return Number.isFinite(value) ? value : null
}

/** power (('*' | '/') power)* */
function parseTerm(p: Parser): number | null {
  let value = parsePower(p)
  if (value === null) return null

  for (;;) {
    skipSpace(p)
    const op = peek(p)
    if (op !== "*" && op !== "/") return value
    p.pos += 1
    const rhs = parsePower(p)
    if (rhs === null) return null
    if (op === "/" && rhs === 0) return null
    value = op === "*" ? value * rhs : value / rhs
    if (!Number.isFinite(value)) return null
  }
}

/** term (('+' | '-') term)* */
function parseExpression(p: Parser): number | null {
  let value = parseTerm(p)
  if (value === null) return null

  for (;;) {
    skipSpace(p)
    const op = peek(p)
    if (op !== "+" && op !== "-") return value
    p.pos += 1
    const rhs = parseTerm(p)
    if (rhs === null) return null
    value = op === "+" ? value + rhs : value - rhs
    if (!Number.isFinite(value)) return null
  }
}

/**
 * The numeric value a student's input denotes, or `null` when the input is not
 * a value at all (empty, malformed, or anything outside the grammar).
 */
export function parseStudentValue(raw: string): number | null {
  if (raw.length > MAX_INPUT_LENGTH) return null

  const text = normalize(raw)
  if (text === "") return null

  // Reject anything containing a character the grammar does not use, before
  // parsing — cheap, and it makes "no execution of student input" obvious.
  if (!/^[0-9+\-*/^().eE ]+$/.test(text)) return null

  const parser: Parser = { text, pos: 0 }
  const value = parseExpression(parser)
  if (value === null) return null

  // Trailing junk means we understood only a prefix — refuse the whole thing.
  skipSpace(parser)
  if (parser.pos !== parser.text.length) return null

  return Number.isFinite(value) ? value : null
}

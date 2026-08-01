/**
 * A small, dollar-quote-aware scanner for `create or replace function` blocks.
 *
 * We cannot regex this: PL/pgSQL bodies are dollar-quoted (`$$ ... $$`) and
 * routinely contain semicolons, `--`, and nested quotes. Anything less than a
 * real scanner mis-slices the bodies, which for a "single source of truth"
 * check would be worse than no check at all.
 *
 * Only the lexical states that can hide a statement terminator are tracked:
 * line comments, block comments, single-quoted literals, and dollar-quoted
 * strings. Double-quoted identifiers cannot span a `;` in the definitions we
 * emit, but are tracked anyway so a quoted identifier containing `;` is safe.
 */

/** Reads the dollar-quote tag at `i` (e.g. `$$` or `$fn$`), or null. */
function readDollarTag(sql, i) {
  if (sql[i] !== "$") return null

  const end = sql.indexOf("$", i + 1)
  if (end === -1) return null

  const tag = sql.slice(i + 1, end)
  // A dollar-quote tag is empty or a valid identifier — `$1` is a positional
  // parameter, not a quote, and must not be mistaken for one.
  if (tag !== "" && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(tag)) return null

  return sql.slice(i, end + 1)
}

/**
 * Splits SQL into top-level statements, preserving each statement's exact
 * source text and its starting offset.
 */
export function splitStatements(sql) {
  const statements = []
  let start = 0
  let i = 0

  while (i < sql.length) {
    const two = sql.slice(i, i + 2)

    if (two === "--") {
      const nl = sql.indexOf("\n", i)
      i = nl === -1 ? sql.length : nl + 1
      continue
    }

    if (two === "/*") {
      // Postgres block comments nest.
      let depth = 1
      i += 2
      while (i < sql.length && depth > 0) {
        if (sql.slice(i, i + 2) === "/*") {
          depth += 1
          i += 2
        } else if (sql.slice(i, i + 2) === "*/") {
          depth -= 1
          i += 2
        } else {
          i += 1
        }
      }
      continue
    }

    if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i]
      i += 1
      while (i < sql.length) {
        if (sql[i] === quote) {
          // A doubled quote is an escaped quote, not a terminator.
          if (sql[i + 1] === quote) {
            i += 2
            continue
          }
          i += 1
          break
        }
        i += 1
      }
      continue
    }

    const tag = readDollarTag(sql, i)
    if (tag) {
      const close = sql.indexOf(tag, i + tag.length)
      i = close === -1 ? sql.length : close + tag.length
      continue
    }

    if (sql[i] === ";") {
      const text = sql.slice(start, i + 1)
      if (text.trim()) statements.push({ text, start })
      i += 1
      start = i
      continue
    }

    i += 1
  }

  const tail = sql.slice(start)
  if (tail.trim()) statements.push({ text: tail, start })

  return statements
}

/** Splits an argument list on top-level commas (parens/quotes aware). */
function splitArgs(argSource) {
  const args = []
  let depth = 0
  let current = ""

  for (let i = 0; i < argSource.length; i += 1) {
    const char = argSource[i]

    if (char === "(") depth += 1
    if (char === ")") depth -= 1

    if (char === "," && depth === 0) {
      args.push(current)
      current = ""
      continue
    }

    current += char
  }

  if (current.trim()) args.push(current)
  return args
}

/**
 * Reduces one declared argument to its type, which is what Postgres uses to
 * identify an overload. `p_worksheet_id uuid default null` → `uuid`.
 */
function argType(arg) {
  let text = arg.replace(/--[^\n]*/g, " ").trim()

  // Strip a DEFAULT expression; it is not part of the identity.
  text = text.replace(/\s+default\s+[\s\S]*$/i, "")
  text = text.replace(/\s*:=[\s\S]*$/, "")

  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ""

  // Drop a leading argmode, then a leading argname.
  let rest = words
  if (/^(in|out|inout|variadic)$/i.test(rest[0]) && rest.length > 1) {
    rest = rest.slice(1)
  }
  if (rest.length > 1) {
    rest = rest.slice(1)
  }

  return rest.join(" ").toLowerCase().replace(/\s+/g, " ")
}

const CREATE_FUNCTION = /create\s+or\s+replace\s+function\s+([a-zA-Z_][\w.]*)\s*\(/i

/**
 * Parses a `create or replace function` statement into its identity.
 * Returns null for statements that are not function definitions.
 */
export function parseFunctionStatement(text) {
  const match = CREATE_FUNCTION.exec(text)
  if (!match) return null

  const openParen = match.index + match[0].length - 1

  // Walk to the matching close paren so nested type parens (e.g. numeric(10,2))
  // do not end the argument list early.
  let depth = 0
  let closeParen = -1
  for (let i = openParen; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1
    if (text[i] === ")") {
      depth -= 1
      if (depth === 0) {
        closeParen = i
        break
      }
    }
  }

  if (closeParen === -1) return null

  const argSource = text.slice(openParen + 1, closeParen)
  const argTypes = splitArgs(argSource).map(argType).filter(Boolean)
  const name = match[1].toLowerCase()

  return {
    name,
    argTypes,
    /** Postgres's own identity for the function, and our canonical key. */
    signature: `${name}(${argTypes.join(", ")})`,
    /**
     * The definition alone, from the `create` keyword onward. A split statement
     * starts after the previous `;`, so it carries whatever comments preceded
     * it — those explain the *migration*, not the function, and including them
     * would make every canonical file differ from its migration by prose.
     */
    definition: text.slice(match.index).trim(),
  }
}

const DROP_FUNCTION = /drop\s+function\s+(?:if\s+exists\s+)?([a-zA-Z_][\w.]*)\s*\(/i

/** Parses a `drop function` statement into the signature it removes. */
export function parseDropFunctionStatement(text) {
  const match = DROP_FUNCTION.exec(text)
  if (!match) return null

  const openParen = match.index + match[0].length - 1
  let depth = 0
  let closeParen = -1
  for (let i = openParen; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1
    if (text[i] === ")") {
      depth -= 1
      if (depth === 0) {
        closeParen = i
        break
      }
    }
  }

  if (closeParen === -1) return null

  const argSource = text.slice(openParen + 1, closeParen)
  const argTypes = splitArgs(argSource).map(argType).filter(Boolean)
  const name = match[1].toLowerCase()

  return { name, argTypes, signature: `${name}(${argTypes.join(", ")})` }
}

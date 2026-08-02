import type { ReactNode } from "react"

export type MathTextSegment =
  | { type: "text"; content: string }
  | { type: "inline"; content: string }
  | { type: "block"; content: string }

/**
 * Math delimiters accepted from model output, longest opener first so `$$`
 * wins over `$`. The prompt asks for `$`/`$$` (see `lib/ai/prompt-rules.ts`),
 * but models fall back to the LaTeX-native `\(…\)` / `\[…\]` often enough that
 * only accepting dollars renders those questions as literal source text.
 */
const MATH_DELIMITERS = [
  { open: "$$", close: "$$", type: "block" },
  { open: "\\[", close: "\\]", type: "block" },
  { open: "\\(", close: "\\)", type: "inline" },
  { open: "$", close: "$", type: "inline" },
] as const

function matchOpener(text: string, index: number) {
  return MATH_DELIMITERS.find((delimiter) => text.startsWith(delimiter.open, index))
}

/**
 * Index of `close` at or after `from`, skipping backslash-escaped characters so
 * a LaTeX row break (`\\`) inside the math cannot be mistaken for a `\)` / `\]`
 * closer, and `\$` cannot close a `$` span.
 */
function findClosing(text: string, from: number, close: string): number {
  let index = from

  while (index < text.length) {
    if (text.startsWith(close, index)) {
      return index
    }

    index += text[index] === "\\" ? 2 : 1
  }

  return -1
}

export function parseMathTextSegments(children: string): MathTextSegment[] {
  const segments: MathTextSegment[] = []
  let text = ""
  let cursor = 0

  function flushText() {
    if (text.length > 0) {
      segments.push({ type: "text", content: text })
      text = ""
    }
  }

  while (cursor < children.length) {
    // `\$` is an escaped dollar in prose, not a math delimiter.
    if (children.startsWith("\\$", cursor)) {
      text += "$"
      cursor += 2
      continue
    }

    const delimiter = matchOpener(children, cursor)
    if (!delimiter) {
      // Consume an escape pair whole so `\\[` (row break) is never read as `\[`.
      const width = children[cursor] === "\\" ? 2 : 1
      text += children.slice(cursor, cursor + width)
      cursor += width
      continue
    }

    const contentStart = cursor + delimiter.open.length
    const contentEnd = findClosing(children, contentStart, delimiter.close)

    if (contentEnd === -1) {
      flushText()
      segments.push({ type: "text", content: children.slice(cursor) })
      return segments
    }

    flushText()
    segments.push({
      type: delimiter.type,
      content: children.slice(contentStart, contentEnd),
    })
    cursor = contentEnd + delimiter.close.length
  }

  flushText()

  return segments
}

export type MathTextRenderer = {
  renderText: (content: string, key: number) => ReactNode
  renderInline: (math: string, key: number) => ReactNode
  renderBlock: (math: string, key: number) => ReactNode
}

export function renderMathTextSegments(
  segments: MathTextSegment[],
  renderer: MathTextRenderer
): ReactNode[] {
  return segments.map((segment, index) => {
    switch (segment.type) {
      case "text":
        return renderer.renderText(segment.content, index)
      case "inline":
        return renderer.renderInline(segment.content, index)
      case "block":
        return renderer.renderBlock(segment.content, index)
    }
  })
}

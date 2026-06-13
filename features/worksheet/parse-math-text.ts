import type { ReactNode } from "react"

export type MathTextSegment =
  | { type: "text"; content: string }
  | { type: "inline"; content: string }
  | { type: "block"; content: string }

export function parseMathTextSegments(children: string): MathTextSegment[] {
  const segments: MathTextSegment[] = []
  let cursor = 0

  while (cursor < children.length) {
    const blockStart = children.indexOf("$$", cursor)
    const inlineStart = children.indexOf("$", cursor)
    const nextStart =
      blockStart === -1
        ? inlineStart
        : inlineStart === -1
          ? blockStart
          : Math.min(blockStart, inlineStart)

    if (nextStart === -1) {
      segments.push({ type: "text", content: children.slice(cursor) })
      break
    }

    if (nextStart > cursor) {
      segments.push({ type: "text", content: children.slice(cursor, nextStart) })
    }

    const isBlock = children.startsWith("$$", nextStart)
    const delimiter = isBlock ? "$$" : "$"
    const contentStart = nextStart + delimiter.length
    const contentEnd = children.indexOf(delimiter, contentStart)

    if (contentEnd === -1) {
      segments.push({ type: "text", content: children.slice(nextStart) })
      break
    }

    const math = children.slice(contentStart, contentEnd)
    segments.push(isBlock ? { type: "block", content: math } : { type: "inline", content: math })
    cursor = contentEnd + delimiter.length
  }

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

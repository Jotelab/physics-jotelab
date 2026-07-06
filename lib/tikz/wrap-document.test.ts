import { describe, expect, it } from "vitest"

import { wrapTikzDocument } from "./wrap-document"

describe("wrapTikzDocument", () => {
  it("wraps a bare tikzpicture in a document body", () => {
    const wrapped = wrapTikzDocument("\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}")

    expect(wrapped.startsWith("\\begin{document}")).toBe(true)
    expect(wrapped.trimEnd().endsWith("\\end{document}")).toBe(true)
    expect(wrapped).toContain("tikzpicture")
  })

  it("trims surrounding whitespace before wrapping", () => {
    const wrapped = wrapTikzDocument("  \n\\begin{tikzpicture}\\end{tikzpicture}\n  ")

    expect(wrapped).toBe(
      "\\begin{document}\n\\begin{tikzpicture}\\end{tikzpicture}\n\\end{document}"
    )
  })

  it("does not double-wrap source that already has a document", () => {
    const source = "\\begin{document}\n\\begin{tikzpicture}\\end{tikzpicture}\n\\end{document}"

    expect(wrapTikzDocument(source)).toBe(source)
    expect(wrapTikzDocument(`  ${source}  `)).toBe(source)
  })
})

import { describe, expect, it } from "vitest"

import { parseMathTextSegments } from "./parse-math-text"

describe("parseMathTextSegments", () => {
  it("parses plain text", () => {
    expect(parseMathTextSegments("hello")).toEqual([{ type: "text", content: "hello" }])
  })

  it("parses inline math", () => {
    expect(parseMathTextSegments("Find $x^2$ here")).toEqual([
      { type: "text", content: "Find " },
      { type: "inline", content: "x^2" },
      { type: "text", content: " here" },
    ])
  })

  it("parses block math", () => {
    expect(parseMathTextSegments("$$a+b$$")).toEqual([{ type: "block", content: "a+b" }])
  })

  it("treats unclosed delimiter remainder as text", () => {
    expect(parseMathTextSegments("broken $x")).toEqual([
      { type: "text", content: "broken " },
      { type: "text", content: "$x" },
    ])
  })

  it("parses LaTeX-native inline delimiters", () => {
    expect(parseMathTextSegments("Find \\(x^2\\) here")).toEqual([
      { type: "text", content: "Find " },
      { type: "inline", content: "x^2" },
      { type: "text", content: " here" },
    ])
  })

  it("parses LaTeX-native block delimiters", () => {
    expect(parseMathTextSegments("\\[a+b\\]")).toEqual([{ type: "block", content: "a+b" }])
  })

  it("keeps a LaTeX command in prose as text", () => {
    expect(parseMathTextSegments("cost \\frac and $x$")).toEqual([
      { type: "text", content: "cost \\frac and " },
      { type: "inline", content: "x" },
    ])
  })

  it("does not let a row break inside math close the span", () => {
    expect(parseMathTextSegments("\\[a \\\\ b\\]")).toEqual([
      { type: "block", content: "a \\\\ b" },
    ])
  })

  it("treats an escaped dollar as literal text", () => {
    expect(parseMathTextSegments("costs \\$5 today")).toEqual([
      { type: "text", content: "costs $5 today" },
    ])
  })
})

import { describe, expect, it } from "vitest"

import { sanitizeSvg } from "./sanitize-svg"

describe("sanitizeSvg", () => {
  it("keeps benign vector markup intact", () => {
    const svg = '<svg viewBox="0 0 10 10"><path d="M0 0L10 10" stroke="#000"/></svg>'
    expect(sanitizeSvg(svg)).toBe(svg)
  })

  it("returns empty string when there is no svg element", () => {
    expect(sanitizeSvg("not svg at all")).toBe("")
    expect(sanitizeSvg("")).toBe("")
  })

  it("strips <script> elements and their contents", () => {
    const out = sanitizeSvg('<svg><script>alert(1)</script><rect/></svg>')
    expect(out).not.toMatch(/script/i)
    expect(out).toContain("<rect/>")
  })

  it("strips <foreignObject> blocks", () => {
    const out = sanitizeSvg('<svg><foreignObject><div onclick="x()">hi</div></foreignObject></svg>')
    expect(out).not.toMatch(/foreignObject/i)
    expect(out).not.toMatch(/onclick/i)
  })

  it("removes inline event handlers", () => {
    const out = sanitizeSvg('<svg><rect onload="steal()" onclick=go x="1"/></svg>')
    expect(out).not.toMatch(/onload/i)
    expect(out).not.toMatch(/onclick/i)
    expect(out).toContain('x="1"')
  })

  it("keeps internal fragment and data refs but drops external ones", () => {
    const out = sanitizeSvg(
      '<svg>' +
        '<use xlink:href="#glyph-1"/>' +
        '<image href="data:image/png;base64,AAAA"/>' +
        '<use href="https://evil.example/x.svg#a"/>' +
        '<a xlink:href="javascript:alert(1)">x</a>' +
        "</svg>"
    )
    expect(out).toContain('xlink:href="#glyph-1"')
    expect(out).toContain('href="data:image/png;base64,AAAA"')
    expect(out).not.toContain("evil.example")
    expect(out).not.toMatch(/javascript:/i)
  })

  it("removes CSS @import rules (external font/stylesheet fetches)", () => {
    const out = sanitizeSvg(
      '<svg><style>@import url(https://cdn.example/fonts.css);.a{fill:red}</style></svg>'
    )
    expect(out).not.toMatch(/@import/i)
    expect(out).toContain(".a{fill:red}")
  })

  it("drops an xml prolog / doctype and starts at <svg>", () => {
    const out = sanitizeSvg(
      '<?xml version="1.0"?><!DOCTYPE svg><svg><path/></svg>'
    )
    expect(out.startsWith("<svg")).toBe(true)
  })
})

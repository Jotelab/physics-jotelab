import { describe, expect, it } from "vitest"

import { buildFontFaceStyle, collectFontFamilies, embedTikzFonts } from "./embed-fonts"

const svgWithFonts =
  '<svg viewBox="0 0 10 10">' +
  '<text font-family="cmmi10">x</text>' +
  '<text font-family="cmr10">1</text>' +
  '<text font-family="cmmi10">y</text>' +
  "</svg>"

function fakeLoader(known: Record<string, Uint8Array>) {
  return (family: string) => known[family] ?? null
}

describe("collectFontFamilies", () => {
  it("returns each referenced family once", () => {
    expect(collectFontFamilies(svgWithFonts).sort()).toEqual(["cmmi10", "cmr10"])
  })

  it("splits comma-separated stacks and trims quotes", () => {
    const svg = "<svg><text font-family=\"'cmr10', serif\">a</text></svg>"
    expect(collectFontFamilies(svg)).toContain("cmr10")
    expect(collectFontFamilies(svg)).toContain("serif")
  })

  it("returns nothing when no font-family is present", () => {
    expect(collectFontFamilies("<svg><path/></svg>")).toEqual([])
  })
})

describe("buildFontFaceStyle", () => {
  it("emits a base64 data-uri @font-face for each resolvable family", () => {
    const style = buildFontFaceStyle(
      ["cmmi10", "cmr10"],
      fakeLoader({ cmmi10: new Uint8Array([1, 2, 3]) })
    )

    expect(style).toContain("@font-face")
    expect(style).toContain("font-family:'cmmi10'")
    expect(style).toContain("data:font/ttf;base64,")
    // cmr10 was not resolvable, so it is skipped rather than emitted empty.
    expect(style).not.toContain("cmr10")
  })

  it("returns an empty string when no families resolve", () => {
    expect(buildFontFaceStyle(["cmmi10"], fakeLoader({}))).toBe("")
  })
})

describe("embedTikzFonts", () => {
  it("inserts the font style just after the opening <svg> tag", () => {
    const out = embedTikzFonts(svgWithFonts, fakeLoader({ cmmi10: new Uint8Array([9]) }))

    const openTagEnd = out.indexOf(">") + 1
    expect(out.slice(openTagEnd)).toMatch(/^<style/)
    expect(out).toContain("font-family:'cmmi10'")
  })

  it("returns the svg unchanged when nothing resolves", () => {
    expect(embedTikzFonts(svgWithFonts, fakeLoader({}))).toBe(svgWithFonts)
  })

  it("returns the input unchanged when there are no fonts to embed", () => {
    const svg = "<svg><path/></svg>"
    expect(embedTikzFonts(svg, fakeLoader({ cmr10: new Uint8Array([1]) }))).toBe(svg)
  })
})

import { describe, expect, it, vi } from "vitest"

import { MAX_DIAGRAM_SVG_LEN, MAX_TIKZ_CODE_LEN } from "@/features/generate/limits"

import { compileTikz, TikzCompileError } from "./compile"

const tikz = "\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}"

describe("compileTikz", () => {
  it("wraps, compiles, embeds fonts, and sanitizes into a usable SVG", async () => {
    const compile = vi.fn(async (doc: string) => {
      expect(doc).toContain("\\begin{document}")
      return '<svg><text font-family="cmr10">1</text><script>bad()</script></svg>'
    })

    const svg = await compileTikz(tikz, {
      compile,
      loadFont: (family) => (family === "cmr10" ? new Uint8Array([1, 2]) : null),
    })

    expect(compile).toHaveBeenCalledOnce()
    expect(svg.startsWith("<svg")).toBe(true)
    expect(svg).toContain("@font-face")
    expect(svg).not.toMatch(/script/i)
  })

  it("rejects empty source without invoking the compiler", async () => {
    const compile = vi.fn()
    await expect(compileTikz("   ", { compile })).rejects.toBeInstanceOf(TikzCompileError)
    expect(compile).not.toHaveBeenCalled()
  })

  it("rejects over-length source", async () => {
    const compile = vi.fn()
    const tooLong = "a".repeat(MAX_TIKZ_CODE_LEN + 1)
    await expect(compileTikz(tooLong, { compile })).rejects.toThrow(/exceeds/)
    expect(compile).not.toHaveBeenCalled()
  })

  it("wraps a TeX engine failure in TikzCompileError", async () => {
    const compile = vi.fn(async () => {
      throw new Error("Missing \\begin{document}")
    })
    await expect(compileTikz(tikz, { compile })).rejects.toBeInstanceOf(TikzCompileError)
  })

  it("throws when the compiler returns no usable SVG", async () => {
    const compile = vi.fn(async () => "TeX log with no svg")
    await expect(compileTikz(tikz, { compile })).rejects.toThrow(/empty or invalid/)
  })

  it("throws when the compiled SVG exceeds the size cap", async () => {
    const huge = `<svg>${"x".repeat(MAX_DIAGRAM_SVG_LEN + 1)}</svg>`
    const compile = vi.fn(async () => huge)
    await expect(compileTikz(tikz, { compile, loadFont: () => null })).rejects.toThrow(/exceeds/)
  })
})

import { describe, expect, it } from "vitest"

import { compileTikz } from "./compile"
import { engineDiagramTikz } from "./engine-diagram"

/**
 * Glyph fidelity of compiled diagram labels.
 *
 * node-tikzjax's DVI→SVG step emits each glyph by reading its **font slot as
 * ASCII**, so any character taken from a math font whose slot means something
 * else in ASCII comes out wrong — and silently, because compilation succeeds:
 *
 * | TeX source        | font/slot   | what the SVG actually contained |
 * | ----------------- | ----------- | ------------------------------- |
 * | `$\mathrm{m/s}$`  | cmmi10 · 61 | `m=s`  (slot 61 is `=` in ASCII) |
 * | `$a = -4$`        | cmsy10      | `a=¡4` (the minus became `¡`)    |
 * | `$5\cdot m$`      | cmsy10      | `5¢m`                            |
 *
 * Letters and digits are unaffected, which is why this went unnoticed: symbols
 * render, units and negatives do not. Every diagram showing a speed, an
 * acceleration, or any negative value was affected — including the sign drills,
 * whose whole point is a negative acceleration.
 *
 * The fix is to keep `=`, values and units in **text mode** (cmr, where the slot
 * mapping is correct) and leave only the italic symbol in math. These tests
 * assert on the **compiled SVG**, not the TeX string: a TeX-level assertion
 * would have passed before the fix too, which is exactly how the bug survived.
 */

/** Characters that only appear when a math-font glyph was mis-mapped. */
const MISMAPPED = ["¡", "¢", "£", "¤", "§"]

function textOf(svg: string): string {
  return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join("")
}

describe("compiled diagram glyphs", () => {
  it("renders a unit's slash as a slash, not an equals sign", async () => {
    const tikz = engineDiagramTikz({
      kind: "motion-1d",
      orientation: "horizontal",
      segments: [
        {
          direction: "forward",
          velocity_in: {
            symbol: "u",
            label: "v_0",
            role: "given",
            value: 20,
            exact: "20",
            unit: "m/s",
          },
        },
      ],
    })
    expect(tikz).not.toBeNull()

    const svg = await compileTikz(tikz!)
    const text = textOf(svg)

    expect(text).toContain("m/s")
    expect(text).not.toContain("m=s")
  }, 180_000)

  it("renders a negative acceleration with a minus, not a mis-mapped symbol", async () => {
    const tikz = engineDiagramTikz({
      kind: "motion-1d",
      orientation: "horizontal",
      segments: [
        {
          direction: "forward",
          acceleration: {
            symbol: "a",
            label: "a",
            role: "given",
            value: -4,
            exact: "-4",
            unit: "m/s^2",
          },
        },
      ],
    })
    expect(tikz).not.toBeNull()

    const svg = await compileTikz(tikz!)
    const text = textOf(svg)

    expect(text).toContain("-4")
    for (const bad of MISMAPPED) {
      expect(text, `mis-mapped glyph ${bad} in ${JSON.stringify(text)}`).not.toContain(bad)
    }
  }, 180_000)

  it("never draws label text from the maths-symbol font", async () => {
    // cmsy10 is the font every mis-mapped glyph above came from. If a label
    // needs it, some character is going to render as the wrong one.
    const tikz = engineDiagramTikz({
      kind: "motion-1d",
      orientation: "horizontal",
      segments: [
        {
          direction: "forward",
          velocity_in: {
            symbol: "u",
            label: "v_0",
            role: "given",
            value: -12,
            exact: "-12",
            unit: "m/s",
          },
          acceleration: {
            symbol: "a",
            label: "a",
            role: "given",
            value: -2,
            exact: "-2",
            unit: "m/s^2",
          },
        },
      ],
    })
    expect(tikz).not.toBeNull()

    const svg = await compileTikz(tikz!)
    expect(svg).not.toMatch(/font-family="[^"]*cmsy/i)
  }, 180_000)
})

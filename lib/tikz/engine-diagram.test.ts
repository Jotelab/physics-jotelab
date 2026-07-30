import { describe, expect, it } from "vitest"

import { engineDiagramTikz } from "./engine-diagram"

const given = (symbol: string, label: string, value: number, unit: string) => ({
  symbol,
  label,
  role: "given" as const,
  value,
  exact: String(value),
  unit,
})

const find = (symbol: string, label: string) => ({ symbol, label, role: "find" as const })

describe("engineDiagramTikz", () => {
  it("returns null for missing or unknown payloads", () => {
    expect(engineDiagramTikz(undefined)).toBeNull()
    expect(engineDiagramTikz(null)).toBeNull()
    expect(engineDiagramTikz({ kind: "hologram" })).toBeNull()
    expect(engineDiagramTikz({ kind: "plot-2d", points: [] })).toBeNull()
  })

  it("draws a horizontal motion figure with values and a hidden find", () => {
    const tikz = engineDiagramTikz({
      kind: "motion-1d",
      orientation: "horizontal",
      segments: [
        {
          direction: "forward",
          velocity_in: given("u", "v_0", 4, "m/s"),
          acceleration: given("a", "a", 2, "m/s^2"),
          velocity_out: find("v", "v"),
        },
      ],
    })
    expect(tikz).toContain("\\begin{tikzpicture}")
    expect(tikz).toContain("$v_0 = 4~\\mathrm{m/s}$")
    expect(tikz).toContain("$a = 2~\\mathrm{m/s^2}$")
    // The find target renders as `?` and its value never appears.
    expect(tikz).toContain("$v = \\,?$")
  })

  it("keeps the answer out even when the payload accidentally carried one", () => {
    const leaky = { ...given("v", "v", 99, "m/s"), role: "find" as const }
    const tikz = engineDiagramTikz({
      kind: "motion-1d",
      segments: [{ velocity_out: leaky }],
    })
    expect(tikz).toContain("$v = \\,?$")
    expect(tikz).not.toContain("99")
  })

  it("draws an out-and-back path with both totals", () => {
    const tikz = engineDiagramTikz({
      kind: "motion-1d",
      orientation: "horizontal",
      segments: [
        { direction: "forward", span: given("d1", "d_1", 30, "m") },
        { direction: "reverse", span: given("d2", "d_2", -10, "m") },
      ],
      totals: [
        { ...find("disp", "\\Delta x"), measures: "displacement" },
        { ...given("dist", "d", 40, "m"), measures: "path" },
      ],
    })
    expect(tikz).toContain("$d_1 = 30~\\mathrm{m}$")
    expect(tikz).toContain("$\\Delta x = \\,?$")
    expect(tikz).toContain("$d = 40~\\mathrm{m}$")
  })

  it("draws the vertical throw: up leg, reverse leg, side totals", () => {
    const tikz = engineDiagramTikz({
      kind: "motion-1d",
      orientation: "vertical",
      segments: [
        { velocity_in: given("u", "v_0", 30, "m/s"), acceleration: given("g", "g", 10, "m/s^2") },
        { direction: "reverse", velocity_out: find("v", "v") },
      ],
      totals: [
        { ...given("h", "h", 25, "m"), measures: "displacement" },
        { ...given("t", "t", 4, "s"), measures: "duration" },
      ],
    })
    expect(tikz).toContain("$v_0 = 30~\\mathrm{m/s}$")
    expect(tikz).toContain("$h = 25~\\mathrm{m}$")
    expect(tikz).toContain("$t = 4~\\mathrm{s}$")
  })

  it("draws a plot with axes, the polyline and tick values", () => {
    const tikz = engineDiagramTikz({
      kind: "plot-2d",
      axes: { x: { symbol: "t", unit: "s" }, y: { symbol: "v", unit: "m/s" } },
      points: [
        { x: { value: 0 }, y: { value: 4 } },
        { x: { value: 3 }, y: { value: 10 } },
        { x: { value: 8 }, y: { value: 10 } },
      ],
    })
    expect(tikz).toContain("$t~(\\mathrm{s})$")
    expect(tikz).toContain("$v~(\\mathrm{m/s})$")
    expect(tikz).toContain("very thick")
    expect(tikz).toContain("{$3$}")
    expect(tikz).toContain("{$10$}")
  })

  it("draws actors with signed arrows and a hidden find", () => {
    const tikz = engineDiagramTikz({
      kind: "actors",
      bodies: [
        { name: "A", velocity: given("va", "v_A", -20, "m/s") },
        { name: "B", velocity: find("vb", "v_B") },
      ],
    })
    expect(tikz).toContain("$A$")
    expect(tikz).toContain("$v_A = -20~\\mathrm{m/s}$")
    expect(tikz).toContain("$v_B = \\,?$")
  })
})

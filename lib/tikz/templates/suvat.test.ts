import { describe, expect, it } from "vitest"

import type { SympyData } from "@/lib/engine/sympy-data"

import { buildTemplateTikz } from "./index"
import { suvatMotionTikz } from "./suvat"

function sympyData(givenSymbols: string[], findSymbol: string): SympyData {
  return {
    topic: "suvat",
    seed: 1,
    given: givenSymbols.map((symbol) => ({
      symbol,
      value: 1,
      exact: "1",
      unit: "m/s",
    })),
    find: { symbol: findSymbol, value: 2, exact: "2", unit: "m/s" },
    steps: [
      { expr_latex: "v = u + a t", substituted_latex: "v = 1 + 1", result_latex: "v = 2" },
    ],
    final_answer: { value: 2, exact: "2", unit: "m/s", latex: "2" },
    policy_applied: "easy",
    plausible: true,
  }
}

describe("suvatMotionTikz", () => {
  it("wraps a tikzpicture and draws the motion axis", () => {
    const tikz = suvatMotionTikz(sympyData(["u", "a", "t"], "v"))
    expect(tikz.startsWith("\\begin{tikzpicture}")).toBe(true)
    expect(tikz.trimEnd().endsWith("\\end{tikzpicture}")).toBe(true)
    expect(tikz).toContain("(0,0) -- (9,0)")
  })

  it("is variable-consistent: labels only the active SUVAT quantities", () => {
    // Given u, a, t → find v: s is not involved, so no displacement bracket.
    const tikz = suvatMotionTikz(sympyData(["u", "a", "t"], "v"))
    expect(tikz).toContain("{$v_0$}") // u
    expect(tikz).toContain("{$a$}")
    expect(tikz).toContain("{$t$}")
    expect(tikz).toContain("{$v$}") // find
    expect(tikz).not.toContain("{$s$}")
  })

  it("labels displacement when s is involved and drops absent quantities", () => {
    // Given s, v, t → find u: no acceleration in play.
    const tikz = suvatMotionTikz(sympyData(["s", "v", "t"], "u"))
    expect(tikz).toContain("{$s$}")
    expect(tikz).toContain("{$v$}")
    expect(tikz).toContain("{$t$}")
    expect(tikz).toContain("{$v_0$}") // find u → v_0
    expect(tikz).not.toContain("{$a$}")
  })

  it("never emits a numeric value (labels are symbols only)", () => {
    const tikz = suvatMotionTikz(sympyData(["u", "a", "t"], "v"))
    // No given/find value ("1"/"2") should leak into a node label.
    expect(tikz).not.toMatch(/\{\$1\$\}|\{\$2\$\}/)
  })

  it("is deterministic for the same payload", () => {
    const data = sympyData(["u", "a", "t"], "v")
    expect(suvatMotionTikz(data)).toBe(suvatMotionTikz(data))
  })
})

describe("buildTemplateTikz", () => {
  it("routes the suvat topic to the motion-diagram template", () => {
    const data = sympyData(["u", "a", "t"], "v")
    expect(buildTemplateTikz(data)).toBe(suvatMotionTikz(data))
  })

  it("returns null for a topic with no diagram template", () => {
    expect(buildTemplateTikz({ ...sympyData(["u", "a", "t"], "v"), topic: "circuits" })).toBeNull()
  })
})

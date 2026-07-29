import { describe, expect, it } from "vitest"

import { SUVAT } from "@/lib/engine/topics"
import type { SympyData } from "@/lib/engine/sympy-data"

import { equationOptions, relationForSplit, SUVAT_RELATIONS } from "./equations"
import { buildCoachProblem, parseExact, questionKey } from "./oracle"

const sympyData: SympyData = {
  topic: "suvat",
  seed: 42,
  given: [
    { symbol: "u", value: 0, exact: "0", unit: "m/s" },
    { symbol: "a", value: 2, exact: "2", unit: "m/s^2" },
    { symbol: "t", value: 5, exact: "5", unit: "s" },
  ],
  find: { symbol: "v", value: 10, exact: "10", unit: "m/s" },
  steps: [
    {
      expr_latex: "v = u + a t",
      substituted_latex: "v = 0 + 2 \\cdot 5",
      result_latex: "v = 10\\ \\text{m/s}",
    },
  ],
  final_answer: { value: 10, exact: "10", unit: "m/s", latex: "10\\ \\text{m/s}" },
  policy_applied: "easy",
  plausible: true,
}

describe("parseExact", () => {
  it("parses integers and fractions losslessly", () => {
    expect(parseExact("10")).toBe(10)
    expect(parseExact("21/2")).toBe(10.5)
    expect(parseExact("-3/4")).toBe(-0.75)
  })

  it("throws on garbage rather than coaching against a wrong oracle", () => {
    expect(() => parseExact("not-a-number")).toThrow()
  })
})

describe("relationForSplit", () => {
  it("maps every valid 4-variable SUVAT set to exactly one relation", () => {
    expect(relationForSplit(["u", "a", "t"], "v")?.id).toBe("v-uat")
    expect(relationForSplit(["u", "a", "s"], "v")?.id).toBe("v2-uas")
    expect(relationForSplit(["v", "a", "t"], "s")?.id).toBe("s-vat")
    // Any permutation of given/find within the same set hits the same relation.
    expect(relationForSplit(["v", "a", "t"], "u")?.id).toBe("v-uat")
  })

  it("returns null for a non-SUVAT split", () => {
    expect(relationForSplit(["u", "a"], "v")).toBeNull()
    expect(relationForSplit(["u", "a", "x"], "v")).toBeNull()
  })
})

describe("equationOptions", () => {
  it("always contains the correct relation and is deterministic per seed", () => {
    const correct = SUVAT_RELATIONS[0]
    const a = equationOptions(correct, 42)
    const b = equationOptions(correct, 42)
    expect(a).toEqual(b)
    expect(a).toHaveLength(4)
    expect(a.map((o) => o.id)).toContain(correct.id)
  })

  it("shuffles differently for different seeds (not always correct-first)", () => {
    const correct = SUVAT_RELATIONS[0]
    const positions = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
        equationOptions(correct, seed).findIndex((o) => o.id === correct.id)
      )
    )
    expect(positions.size).toBeGreaterThan(1)
  })
})

describe("buildCoachProblem", () => {
  it("derives every field from sympy_data (the engine is the oracle)", () => {
    const problem = buildCoachProblem(sympyData, SUVAT)
    expect(problem).not.toBeNull()
    expect(problem!.correctEquationId).toBe("v-uat")
    expect(problem!.substitutionFields).toEqual([
      { symbol: "u", displaySymbol: "v₀", label: "ความเร็วต้น", unit: "m/s", value: 0 },
      { symbol: "a", displaySymbol: "a", label: "ความเร่ง", unit: "m/s²", value: 2 },
      { symbol: "t", displaySymbol: "t", label: "เวลา", unit: "s", value: 5 },
    ])
    expect(problem!.answer).toEqual({
      value: 10,
      exact: "10",
      unit: "m/s",
      latex: "10\\ \\text{m/s}",
    })
    expect(problem!.find.displaySymbol).toBe("v")
    expect(problem!.workedStep.exprLatex).toBe("v = u + a t")
    // The Thai statement carries every given and the find label.
    expect(problem!.questionText).toContain("ความเร็วต้น")
    expect(problem!.questionText).toContain("จงหาความเร็วปลาย")
    expect(problem!.sympyData).toBe(sympyData)
  })

  it("refuses a payload whose split is not in the SUVAT bank", () => {
    const foreign = {
      ...sympyData,
      topic: "free-fall",
      given: [
        { symbol: "g", value: 10, exact: "10", unit: "m/s^2" },
        { symbol: "t", value: 5, exact: "5", unit: "s" },
        { symbol: "u", value: 0, exact: "0", unit: "m/s" },
      ],
    }
    expect(buildCoachProblem(foreign, SUVAT)).toBeNull()
  })
})

describe("questionKey", () => {
  it("is stable and re-derivable", () => {
    expect(questionKey(sympyData)).toBe("suvat:42:v")
  })
})

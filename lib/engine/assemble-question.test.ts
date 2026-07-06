import { describe, expect, it } from "vitest"

import { calculationQuestionSchema } from "@/features/generate/schemas"

import { assembleEngineQuestion } from "./assemble-question"
import type { SympyData } from "./sympy-data"
import { resolveEngineTopic } from "./topics"

const SUVAT = resolveEngineTopic("motion-1d", "physics")!

const SYMPY: SympyData = {
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

describe("assembleEngineQuestion", () => {
  const question = assembleEngineQuestion(SYMPY, SUVAT, "  จงหาความเร็วปลาย  ")

  it("builds givens with display symbols/labels/units from the topic table", () => {
    expect(question.given_values).toEqual([
      { symbol: "v₀", label: "ความเร็วต้น", value: 0, unit: "m/s" },
      { symbol: "a", label: "ความเร่ง", value: 2, unit: "m/s²" },
      { symbol: "t", label: "เวลา", value: 5, unit: "s" },
    ])
  })

  it("builds the target from the find variable", () => {
    expect(question.target_variable).toEqual({
      symbol: "v",
      label: "ความเร็วปลาย",
      unit: "m/s",
    })
  })

  it("renders each engine step as three inline-math lines and trims the prose", () => {
    expect(question.question_text).toBe("จงหาความเร็วปลาย")
    expect(question.solution.steps).toEqual([
      "$v = u + a t$",
      "$v = 0 + 2 \\cdot 5$",
      "$v = 10\\ \\text{m/s}$",
    ])
    expect(question.solution.final_answer).toBe("$10\\ \\text{m/s}$")
  })

  it("attaches sympy_data verbatim and stays schema-valid", () => {
    expect(question.sympy_data).toBe(SYMPY)
    expect(calculationQuestionSchema.safeParse(question).success).toBe(true)
  })
})

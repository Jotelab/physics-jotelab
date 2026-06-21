import { describe, expect, it } from "vitest"

import { validGeneratedQuestion } from "@/tests/fixtures/worksheet-question"

import { normalizeGeneratedQuestion } from "./normalize-question"

describe("normalizeGeneratedQuestion", () => {
  it("trims text fields and drops empty units", () => {
    const result = normalizeGeneratedQuestion({
      ...validGeneratedQuestion,
      question_text: "  จงหา x  ",
      given_values: [
        {
          symbol: " a ",
          label: " สัมประสิทธิ์ ",
          value: " 3 ",
          unit: "   ",
        },
      ],
      target_variable: {
        symbol: " x ",
        label: " ค่า ",
        unit: "",
      },
      solution: {
        steps: ["  step one  ", "", "  step two  "],
        final_answer: "  5  ",
      },
    })

    expect(result.question_text).toBe("จงหา x")
    expect(result.given_values[0]).toEqual({
      symbol: "a",
      label: "สัมประสิทธิ์",
      value: 3,
    })
    expect(result.target_variable).toEqual({ symbol: "x", label: "ค่า" })
    expect(result.solution.steps).toEqual(["step one", "step two"])
    expect(result.solution.final_answer).toBe("5")
  })

  it("coerces numeric strings and preserves non-numeric strings", () => {
    const result = normalizeGeneratedQuestion(
      {
        ...validGeneratedQuestion,
        given_values: [
          { symbol: "m", label: "mass", value: "12.5" },
          { symbol: "v", label: "velocity", value: "fast" },
        ],
      },
      { mathComplexity: "decimals" }
    )

    expect(result.given_values[0]?.value).toBe(12.5)
    expect(result.given_values[1]?.value).toBe("fast")
  })

  it("rounds numeric values to integers by default", () => {
    const result = normalizeGeneratedQuestion({
      ...validGeneratedQuestion,
      given_values: [{ symbol: "m", label: "mass", value: "12.7" }],
    })

    expect(result.given_values[0]?.value).toBe(13)
  })
})

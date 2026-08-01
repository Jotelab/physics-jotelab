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

  it("collapses double-escaped LaTeX commands in prose and math fields", () => {
    const result = normalizeGeneratedQuestion({
      ...validGeneratedQuestion,
      question_text: "จงหา $\\\\frac{F}{m}$",
      solution: {
        steps: ["$a = \\\\frac{F}{m}$", "$a = 5\\\\ \\\\text{m/s}^2$"],
        final_answer: "$\\\\text{5 m/s}^2$",
      },
    })

    expect(result.question_text).toBe("จงหา $\\frac{F}{m}$")
    expect(result.solution.steps).toEqual([
      "$a = \\frac{F}{m}$",
      "$a = 5\\\\ \\text{m/s}^2$",
    ])
    expect(result.solution.final_answer).toBe("$\\text{5 m/s}^2$")
  })

  it("leaves a real LaTeX row break intact, including before a command", () => {
    const result = normalizeGeneratedQuestion({
      ...validGeneratedQuestion,
      solution: {
        // `\\` + newline (row break) and `\\` + `\text` (row break then command).
        steps: ["$$a = 1 \\\\ b = 2$$", "$$a = 1 \\\\\\text{ต่อ}$$"],
        final_answer: "5",
      },
    })

    expect(result.solution.steps).toEqual([
      "$$a = 1 \\\\ b = 2$$",
      "$$a = 1 \\\\\\text{ต่อ}$$",
    ])
  })

  it("rounds numeric values to integers by default", () => {
    const result = normalizeGeneratedQuestion({
      ...validGeneratedQuestion,
      given_values: [{ symbol: "m", label: "mass", value: "12.7" }],
    })

    expect(result.given_values[0]?.value).toBe(13)
  })
})

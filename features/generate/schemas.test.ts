import { describe, expect, it } from "vitest"

import {
  MAX_GIVEN_VARIABLES,
  MAX_INITIAL_WORKSHEET_QUESTION_COUNT,
  MAX_LESSON_LEN,
  MAX_QUESTION_TEXT_LEN,
  MAX_SCENARIO_LEN,
} from "./limits"
import {
  generateWorksheetInputSchema,
  generatedQuestionSchema,
  generationSettingsSchema,
  worksheetQuestionSchema,
} from "./schemas"
import { validGeneratedQuestion, validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

describe("generateWorksheetInputSchema", () => {
  it("accepts valid input", () => {
    const result = generateWorksheetInputSchema.safeParse({
      subject: "math",
      lesson: "Linear equations",
      scenario: "Solve for x.",
      question_count: 10,
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty lesson and scenario", () => {
    expect(
      generateWorksheetInputSchema.safeParse({
        subject: "math",
        lesson: "   ",
        scenario: "Solve.",
        question_count: 5,
      }).success
    ).toBe(false)
    expect(
      generateWorksheetInputSchema.safeParse({
        subject: "physics",
        lesson: "Motion",
        scenario: "",
        question_count: 5,
      }).success
    ).toBe(false)
  })

  it("accepts optional given and target variables", () => {
    const result = generateWorksheetInputSchema.safeParse({
      subject: "physics",
      lesson: "Motion",
      scenario: "Find final velocity.",
      question_count: 5,
      given_variables: [{ symbol: "v₀", label: "initial velocity", value: 0, unit: "m/s" }],
      target_variables: [{ symbol: "v", label: "final velocity", unit: "m/s" }],
    })
    expect(result.success).toBe(true)
  })

  it("rejects more than one target variable", () => {
    const result = generateWorksheetInputSchema.safeParse({
      subject: "physics",
      lesson: "Motion",
      scenario: "Find values.",
      question_count: 5,
      target_variables: [
        { symbol: "v", label: "velocity" },
        { symbol: "a", label: "acceleration" },
      ],
    })
    expect(result.success).toBe(false)
  })

  it("rejects lesson and scenario over max length", () => {
    expect(
      generateWorksheetInputSchema.safeParse({
        subject: "math",
        lesson: "x".repeat(MAX_LESSON_LEN + 1),
        scenario: "Solve.",
        question_count: 5,
      }).success
    ).toBe(false)
    expect(
      generateWorksheetInputSchema.safeParse({
        subject: "math",
        lesson: "Trig",
        scenario: "x".repeat(MAX_SCENARIO_LEN + 1),
        question_count: 5,
      }).success
    ).toBe(false)
  })

  it("rejects question_count outside 1–20", () => {
    expect(
      generateWorksheetInputSchema.safeParse({
        subject: "math",
        lesson: "Trig",
        scenario: "Find angle.",
        question_count: 0,
      }).success
    ).toBe(false)
    expect(
      generateWorksheetInputSchema.safeParse({
        subject: "math",
        lesson: "Trig",
        scenario: "Find angle.",
        question_count: MAX_INITIAL_WORKSHEET_QUESTION_COUNT + 1,
      }).success
    ).toBe(false)
  })
})

describe("worksheetQuestionSchema", () => {
  it("accepts a valid worksheet question", () => {
    expect(worksheetQuestionSchema.safeParse(validWorksheetQuestion).success).toBe(true)
  })

  it("requires a UUID id and positive order", () => {
    expect(
      worksheetQuestionSchema.safeParse({ ...validWorksheetQuestion, id: "not-a-uuid" }).success
    ).toBe(false)
    expect(
      worksheetQuestionSchema.safeParse({ ...validWorksheetQuestion, order: 0 }).success
    ).toBe(false)
  })
})

describe("generationSettingsSchema", () => {
  it("accepts valid settings", () => {
    expect(
      generationSettingsSchema.safeParse({
        lesson: "Motion",
        scenario: "Find velocity.",
      }).success
    ).toBe(true)
  })

  it("accepts optional header settings", () => {
    expect(
      generationSettingsSchema.safeParse({
        lesson: "Motion",
        scenario: "Find velocity.",
        header: {
          title: "Quiz 1",
          instructions: "Show your work.",
          fields: {
            showStudentName: true,
            showDate: true,
            showClassSection: false,
            showScoreBox: false,
          },
        },
      }).success
    ).toBe(true)
  })

  it("rejects oversized lesson and scenario", () => {
    expect(
      generationSettingsSchema.safeParse({
        lesson: "x".repeat(MAX_LESSON_LEN + 1),
        scenario: "ok",
      }).success
    ).toBe(false)
    expect(
      generationSettingsSchema.safeParse({
        lesson: "ok",
        scenario: "x".repeat(MAX_SCENARIO_LEN + 1),
      }).success
    ).toBe(false)
  })
})

describe("generatedQuestionSchema", () => {
  it("accepts valid generated questions", () => {
    expect(generatedQuestionSchema.safeParse(validGeneratedQuestion).success).toBe(true)
  })

  it("rejects oversized question_text and too many given_values", () => {
    expect(
      generatedQuestionSchema.safeParse({
        ...validGeneratedQuestion,
        question_text: "x".repeat(MAX_QUESTION_TEXT_LEN + 1),
      }).success
    ).toBe(false)

    const manyGiven = Array.from({ length: MAX_GIVEN_VARIABLES + 1 }, (_, index) => ({
      symbol: `v${index}`,
      label: `label ${index}`,
      value: index,
    }))
    expect(
      generatedQuestionSchema.safeParse({
        ...validGeneratedQuestion,
        given_values: manyGiven,
      }).success
    ).toBe(false)
  })

  it("requires non-empty given_values and solution steps", () => {
    expect(
      generatedQuestionSchema.safeParse({ ...validGeneratedQuestion, given_values: [] }).success
    ).toBe(false)
    expect(
      generatedQuestionSchema.safeParse({
        ...validGeneratedQuestion,
        solution: { steps: [], final_answer: "x" },
      }).success
    ).toBe(false)
  })
})

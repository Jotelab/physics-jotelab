import { describe, expect, it } from "vitest"

import {
  MAX_EXTEND_QUESTIONS_PER_REQUEST,
  MAX_INITIAL_WORKSHEET_QUESTION_COUNT,
  MAX_WORKSHEET_QUESTION_COUNT,
} from "@/features/generate/limits"

import { computeWorksheetCreditLimits } from "./compute-worksheet-credit-limits"

const baseInput = {
  availableCredits: 10,
  questionCount: 15,
  hasRequiredFields: true,
  isGenerating: false,
  worksheetId: "ws-1",
  worksheetTargetCount: 10,
  questionsCount: 3,
  displayItemsCount: 3,
  hasActiveWorksheetMeta: true,
  hasGeneratedMock: false,
  isDev: false,
}

describe("computeWorksheetCreditLimits", () => {
  it("caps effectiveQuestionCount by available credits and initial max", () => {
    const result = computeWorksheetCreditLimits({
      ...baseInput,
      availableCredits: 5,
      questionCount: 20,
    })

    expect(result.maxQuestionCount).toBe(5)
    expect(result.effectiveQuestionCount).toBe(5)
    expect(result.cost).toBe(5)
  })

  it("uses initial max when credits exceed it", () => {
    const result = computeWorksheetCreditLimits({
      ...baseInput,
      availableCredits: 100,
      questionCount: 25,
    })

    expect(result.maxQuestionCount).toBe(MAX_INITIAL_WORKSHEET_QUESTION_COUNT)
    expect(result.effectiveQuestionCount).toBe(MAX_INITIAL_WORKSHEET_QUESTION_COUNT)
  })

  it("disables generate when required fields missing or no credits", () => {
    expect(
      computeWorksheetCreditLimits({ ...baseInput, hasRequiredFields: false }).canGenerate
    ).toBe(false)
    expect(computeWorksheetCreditLimits({ ...baseInput, availableCredits: 0 }).canGenerate).toBe(
      false
    )
    expect(computeWorksheetCreditLimits({ ...baseInput, isGenerating: true }).canGenerate).toBe(
      false
    )
  })

  it("enables hasGenerated from dev mock without worksheet", () => {
    const result = computeWorksheetCreditLimits({
      ...baseInput,
      isDev: true,
      hasGeneratedMock: true,
      worksheetId: null,
      questionsCount: 0,
    })

    expect(result.hasGenerated).toBe(true)
  })

  it("enables hasGenerated when worksheet has questions and is idle", () => {
    const result = computeWorksheetCreditLimits({
      ...baseInput,
      worksheetId: "ws-1",
      questionsCount: 2,
      isGenerating: false,
    })

    expect(result.hasGenerated).toBe(true)
  })

  it("disables canAppend when generating or at worksheet cap", () => {
    expect(computeWorksheetCreditLimits({ ...baseInput, isGenerating: true }).canAppend).toBe(
      false
    )

    const atCap = computeWorksheetCreditLimits({
      ...baseInput,
      worksheetTargetCount: MAX_WORKSHEET_QUESTION_COUNT,
    })
    expect(atCap.maxAppendable).toBe(0)
    expect(atCap.canAppend).toBe(false)
  })

  it("limits maxAppendable by credits, extend cap, and remaining worksheet slots", () => {
    const result = computeWorksheetCreditLimits({
      ...baseInput,
      availableCredits: 3,
      worksheetTargetCount: MAX_WORKSHEET_QUESTION_COUNT - 2,
    })

    expect(result.maxAppendable).toBe(2)
    expect(result.canAppend).toBe(true)
  })

  it("caps maxAppendable at MAX_EXTEND_QUESTIONS_PER_REQUEST", () => {
    const result = computeWorksheetCreditLimits({
      ...baseInput,
      availableCredits: 100,
      worksheetTargetCount: 5,
    })

    expect(result.maxAppendable).toBe(MAX_EXTEND_QUESTIONS_PER_REQUEST)
  })

  it("requires active worksheet meta for hasActiveWorksheet", () => {
    expect(
      computeWorksheetCreditLimits({
        ...baseInput,
        hasActiveWorksheetMeta: false,
        displayItemsCount: 5,
      }).hasActiveWorksheet
    ).toBe(false)

    expect(
      computeWorksheetCreditLimits({
        ...baseInput,
        hasActiveWorksheetMeta: true,
        displayItemsCount: 0,
        isGenerating: true,
      }).hasActiveWorksheet
    ).toBe(true)
  })
})

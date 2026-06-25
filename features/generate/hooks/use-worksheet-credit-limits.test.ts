import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  MAX_WORKSHEET_QUESTION_COUNT,
} from "@/features/generate/limits"
import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

import { useWorksheetCreditLimits } from "./use-worksheet-credit-limits"

const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"

function renderCreditLimits(
  overrides: Partial<Parameters<typeof useWorksheetCreditLimits>[0]> = {}
) {
  return renderHook(() =>
    useWorksheetCreditLimits({
      creditBalance: 10,
      questionCount: 10,
      hasRequiredFields: true,
      isGenerating: false,
      worksheetId,
      targetQuestionCount: 10,
      questions: [validWorksheetQuestion],
      skippedSlots: [],
      ...overrides,
    })
  )
}

describe("useWorksheetCreditLimits", () => {

  it("enables append when worksheet, credits, and generation state allow it", () => {
    const { result } = renderCreditLimits()

    expect(result.current.canAppend).toBe(true)
    expect(result.current.maxAppendable).toBe(10)
  })

  it("disables append while generation is running", () => {
    const { result } = renderCreditLimits({ isGenerating: true })

    expect(result.current.canAppend).toBe(false)
  })

  it("disables append without a worksheet id", () => {
    const { result } = renderCreditLimits({ worksheetId: null })

    expect(result.current.canAppend).toBe(false)
  })

  it("disables append when credits are exhausted", () => {
    const { result } = renderCreditLimits({ creditBalance: 0 })

    expect(result.current.canAppend).toBe(false)
    expect(result.current.canGenerate).toBe(false)
  })

  it("reflects partial credits in effective question count and cost", () => {
    const { result } = renderCreditLimits({
      creditBalance: 3,
      questionCount: 10,
      worksheetId: null,
      targetQuestionCount: null,
      questions: [],
    })

    expect(result.current.maxQuestionCount).toBe(3)
    expect(result.current.effectiveQuestionCount).toBe(3)
    expect(result.current.cost).toBe(3)
    expect(result.current.hasPartialCredits).toBe(false)
    expect(result.current.canGenerate).toBe(true)
  })

  it("disables append until the worksheet has generated content", () => {
    const { result } = renderCreditLimits({
      worksheetId,
      targetQuestionCount: 10,
      questions: [],
    })

    expect(result.current.hasGenerated).toBe(false)
    expect(result.current.canAppend).toBe(false)
  })

  it("disables append when targetQuestionCount is unknown", () => {
    const { result } = renderCreditLimits({
      targetQuestionCount: null,
    })

    expect(result.current.worksheetTargetCount).toBeNull()
    expect(result.current.maxAppendable).toBe(0)
    expect(result.current.canAppend).toBe(false)
  })

  it("limits maxAppendable by remaining credits after generation", () => {
    const { result } = renderCreditLimits({
      creditBalance: 2,
      targetQuestionCount: 10,
    })

    expect(result.current.maxAppendable).toBe(2)
    expect(result.current.canAppend).toBe(true)
  })

  it("treats skipped slots as active worksheet display items", () => {
    const { result } = renderCreditLimits({
      questions: [],
      skippedSlots: [{ order: 1, message: "Skipped." }],
    })

    act(() => {
      result.current.setActiveWorksheetMeta({
        subjectLabel: "Physics",
        lesson: "Motion",
        scenario: "Find velocity.",
        questionCount: 10,
      })
    })

    expect(result.current.hasActiveWorksheet).toBe(true)
  })

  it("updates append limits when localCreditBalanceOverride changes after generation", () => {
    const { result } = renderCreditLimits({
      creditBalance: 20,
      targetQuestionCount: 10,
    })

    expect(result.current.canAppend).toBe(true)
    expect(result.current.maxAppendable).toBe(20)

    act(() => {
      result.current.setLocalCreditBalanceOverride(1)
    })

    expect(result.current.availableCredits).toBe(1)
    expect(result.current.maxAppendable).toBe(1)
    expect(result.current.canAppend).toBe(true)
  })

  it("disables generate when required fields are missing", () => {
    const { result } = renderCreditLimits({ hasRequiredFields: false })

    expect(result.current.canGenerate).toBe(false)
  })

  it("uses localCreditBalanceOverride for availableCredits and limits", () => {
    const { result } = renderCreditLimits({ creditBalance: 20 })

    act(() => {
      result.current.setLocalCreditBalanceOverride(3)
    })

    expect(result.current.availableCredits).toBe(3)
    expect(result.current.maxQuestionCount).toBe(3)
    expect(result.current.maxAppendable).toBe(3)
  })

  it("disables append when the worksheet is at the question cap", () => {
    const { result } = renderCreditLimits({
      targetQuestionCount: MAX_WORKSHEET_QUESTION_COUNT,
    })

    expect(result.current.maxAppendable).toBe(0)
    expect(result.current.canAppend).toBe(false)
  })

  it("does not treat the dev mock toggle as generated outside development", () => {
    const { result } = renderCreditLimits({
      worksheetId: null,
      questions: [],
      targetQuestionCount: null,
    })

    expect(result.current.showDevMockToggle).toBe(false)
    expect(result.current.hasGenerated).toBe(false)

    act(() => {
      result.current.toggleGeneratedMock()
    })

    expect(result.current.hasGenerated).toBe(false)
  })
})

describe("useWorksheetCreditLimits in development", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("enables hasGenerated from the dev mock toggle", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.resetModules()

    const { useWorksheetCreditLimits: useDevCreditLimits } = await import(
      "./use-worksheet-credit-limits"
    )

    const { result } = renderHook(() =>
      useDevCreditLimits({
        creditBalance: 10,
        questionCount: 10,
        hasRequiredFields: true,
        isGenerating: false,
        worksheetId: null,
        targetQuestionCount: 10,
        questions: [],
        skippedSlots: [],
      })
    )

    expect(result.current.showDevMockToggle).toBe(true)
    expect(result.current.hasGenerated).toBe(false)

    act(() => {
      result.current.toggleGeneratedMock()
    })

    expect(result.current.hasGenerated).toBe(true)
    expect(result.current.canAppend).toBe(false)
  })

  it("enables append from dev mock when worksheet and credits are ready", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.resetModules()

    const { useWorksheetCreditLimits: useDevCreditLimits } = await import(
      "./use-worksheet-credit-limits"
    )

    const { result } = renderHook(() =>
      useDevCreditLimits({
        creditBalance: 5,
        questionCount: 5,
        hasRequiredFields: true,
        isGenerating: false,
        worksheetId,
        targetQuestionCount: 10,
        questions: [],
        skippedSlots: [],
      })
    )

    act(() => {
      result.current.toggleGeneratedMock()
    })

    expect(result.current.hasGenerated).toBe(true)
    expect(result.current.canAppend).toBe(true)
    expect(result.current.maxAppendable).toBe(5)
  })
})

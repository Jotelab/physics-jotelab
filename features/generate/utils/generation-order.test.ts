import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { GenerateQuestionResult } from "@/features/generate/result-types"
import { failure } from "@/features/generate/errors"
import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

import {
  appendCreditExhaustedSkips,
  buildPreviousQuestionsContext,
  GENERATION_RETRY_DELAY_MS,
  generateQuestionWithRetry,
} from "./generation-order"

function questionAtOrder(order: number) {
  return {
    ...validWorksheetQuestion,
    id: `00000000-0000-4000-8000-${String(order).padStart(12, "0")}`,
    order,
    question_text: `Question ${order}`,
  }
}

describe("buildPreviousQuestionsContext", () => {
  it("returns prior question text sorted by order and excludes current and later orders", () => {
    const context = buildPreviousQuestionsContext(
      [questionAtOrder(3), questionAtOrder(1), questionAtOrder(2)],
      3
    )

    expect(context).toEqual(["Question 1", "Question 2"])
  })
})

describe("generateQuestionWithRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns the first successful result without retrying", async () => {
    const generateQuestion = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: { question: questionAtOrder(1), creditBalance: 9 },
      } satisfies GenerateQuestionResult)

    const result = await generateQuestionWithRetry({
      order: 1,
      previousQuestionsContext: [],
      generateQuestion,
    })

    expect(result.ok).toBe(true)
    expect(generateQuestion).toHaveBeenCalledTimes(1)
  })

  it("returns non-retryable failures without a second attempt", async () => {
    const generateQuestion = vi.fn().mockResolvedValue(
      failure("WORKSHEET_ACCESS_DENIED") satisfies GenerateQuestionResult
    )

    const result = await generateQuestionWithRetry({
      order: 1,
      previousQuestionsContext: [],
      generateQuestion,
    })

    expect(result).toEqual(failure("WORKSHEET_ACCESS_DENIED"))
    expect(generateQuestion).toHaveBeenCalledTimes(1)
  })

  it("does not retry when credits are insufficient", async () => {
    const generateQuestion = vi.fn().mockResolvedValue(
      failure("INSUFFICIENT_CREDITS") satisfies GenerateQuestionResult
    )

    const result = await generateQuestionWithRetry({
      order: 2,
      previousQuestionsContext: ["Question 1"],
      generateQuestion,
    })

    expect(result).toEqual(failure("INSUFFICIENT_CREDITS"))
    expect(generateQuestion).toHaveBeenCalledTimes(1)
  })

  it("retries retriable failures then succeeds", async () => {
    vi.useFakeTimers()
    const onRetryScheduled = vi.fn()
    const generateQuestion = vi
      .fn()
      .mockResolvedValueOnce(failure("GENERATE_FAILED") satisfies GenerateQuestionResult)
      .mockResolvedValueOnce({
        ok: true,
        data: { question: questionAtOrder(1), creditBalance: 9 },
      } satisfies GenerateQuestionResult)

    const retryPromise = generateQuestionWithRetry({
      order: 1,
      previousQuestionsContext: [],
      generateQuestion,
      onRetryScheduled,
    })

    await vi.advanceTimersByTimeAsync(GENERATION_RETRY_DELAY_MS)
    const result = await retryPromise

    expect(generateQuestion).toHaveBeenCalledTimes(2)
    expect(onRetryScheduled).toHaveBeenCalledWith(1)
    expect(result.ok).toBe(true)
  })
})

describe("appendCreditExhaustedSkips", () => {
  it("marks remaining unfilled orders when credits run out", () => {
    const newSkips = appendCreditExhaustedSkips({
      fromOrder: 2,
      toOrder: 3,
      questions: [questionAtOrder(1)],
      skippedSlots: [],
    })

    expect(newSkips).toEqual([
      {
        order: 2,
        message: "Question 2 was skipped because you do not have enough credits.",
      },
      {
        order: 3,
        message: "Question 3 was skipped because you do not have enough credits.",
      },
    ])
  })

  it("skips orders that are already filled or already marked skipped", () => {
    const newSkips = appendCreditExhaustedSkips({
      fromOrder: 2,
      toOrder: 4,
      questions: [questionAtOrder(1), questionAtOrder(3)],
      skippedSlots: [{ order: 2, message: "Already skipped" }],
    })

    expect(newSkips).toEqual([
      {
        order: 4,
        message: "Question 4 was skipped because you do not have enough credits.",
      },
    ])
  })
})

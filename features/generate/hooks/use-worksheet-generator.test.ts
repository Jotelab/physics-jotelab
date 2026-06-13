import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { GenerationJobPollResult } from "@/features/generate/generation-job-types"
import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

const getWorksheetQuestionCountAction = vi.fn()
const startWorksheetGenerationJobAction = vi.fn()
const startAppendGenerationJobAction = vi.fn()
const getGenerationJobAction = vi.fn()
const getActiveGenerationJobForWorksheetAction = vi.fn()

vi.mock("@/features/generate/actions", () => ({
  getWorksheetQuestionCountAction: (...args: unknown[]) =>
    getWorksheetQuestionCountAction(...args),
}))

vi.mock("@/features/generate/generation-job-actions", () => ({
  startWorksheetGenerationJobAction: (...args: unknown[]) =>
    startWorksheetGenerationJobAction(...args),
  startAppendGenerationJobAction: (...args: unknown[]) =>
    startAppendGenerationJobAction(...args),
  getGenerationJobAction: (...args: unknown[]) => getGenerationJobAction(...args),
  getActiveGenerationJobForWorksheetAction: (...args: unknown[]) =>
    getActiveGenerationJobForWorksheetAction(...args),
}))

import { useWorksheetGenerator } from "./use-worksheet-generator"

const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
const jobId = "b1b2c3d4-e5f6-4789-a012-3456789abcde"

const generateInput = {
  subject: "physics" as const,
  lesson: "Motion",
  scenario: "Find velocity.",
  question_count: 2,
}

function questionAtOrder(order: number) {
  return {
    ...validWorksheetQuestion,
    id: `00000000-0000-4000-8000-${String(order).padStart(12, "0")}`,
    order,
    question_text: `Question ${order}`,
  }
}

function terminalPoll(
  overrides: Partial<GenerationJobPollResult> = {}
): GenerationJobPollResult {
  const questions = overrides.questions ?? [questionAtOrder(1), questionAtOrder(2)]

  return {
    jobId,
    worksheetId,
    status: "completed",
    kind: "initial",
    fromOrder: 1,
    toOrder: 2,
    lastCompletedOrder: 2,
    targetQuestionCount: 2,
    progress: { current: 2, total: 2 },
    questions,
    skippedSlots: [],
    statusMessage: "Worksheet complete.",
    creditBalance: 8,
    isTerminal: true,
    stoppedForCredits: false,
    ...overrides,
  }
}

describe("useWorksheetGenerator", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getWorksheetQuestionCountAction.mockResolvedValue({ ok: true, data: { questionCount: 25 } })
    getActiveGenerationJobForWorksheetAction.mockResolvedValue({ ok: true, data: null })
    getGenerationJobAction.mockResolvedValue({
      ok: true,
      data: terminalPoll(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("syncTargetQuestionCount updates targetQuestionCount from the database", async () => {
    getWorksheetQuestionCountAction.mockResolvedValue({ ok: true, data: { questionCount: 15 } })

    const { result } = renderHook(() => useWorksheetGenerator())

    let syncedCount: number | null | undefined

    await act(async () => {
      syncedCount = await result.current.syncTargetQuestionCount(worksheetId)
    })

    expect(syncedCount).toBe(15)
    expect(result.current.targetQuestionCount).toBe(15)
    expect(getWorksheetQuestionCountAction).toHaveBeenCalledWith(worksheetId)
  })

  it("completes startGeneration when the background job finishes", async () => {
    const onCreditBalanceUpdated = vi.fn()
    startWorksheetGenerationJobAction.mockResolvedValue({
      ok: true,
      data: { jobId, worksheetId },
    })

    const { result } = renderHook(() => useWorksheetGenerator({ onCreditBalanceUpdated }))

    await act(async () => {
      await result.current.startGeneration(generateInput)
    })

    expect(result.current.worksheetId).toBe(worksheetId)
    expect(result.current.questions).toHaveLength(2)
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.statusMessage).toBe("Worksheet complete.")
    expect(onCreditBalanceUpdated).toHaveBeenCalledWith(8)
    expect(startWorksheetGenerationJobAction).toHaveBeenCalledWith(generateInput)
    expect(getGenerationJobAction).toHaveBeenCalledWith(jobId)
  })

  it("sets an error when job start fails", async () => {
    startWorksheetGenerationJobAction.mockResolvedValue({
      ok: false,
      message: "Could not start worksheet generation.",
    })

    const { result } = renderHook(() => useWorksheetGenerator())

    await act(async () => {
      await result.current.startGeneration(generateInput)
    })

    expect(result.current.error).toBe("Could not start worksheet generation.")
    expect(result.current.isGenerating).toBe(false)
    expect(getGenerationJobAction).not.toHaveBeenCalled()
  })

  it("sets an error when job start throws", async () => {
    startWorksheetGenerationJobAction.mockRejectedValue(new Error("network down"))

    const { result } = renderHook(() => useWorksheetGenerator())

    await act(async () => {
      await result.current.startGeneration(generateInput)
    })

    expect(result.current.error).toBe(
      "Generation stopped before it could start. Please try again."
    )
    expect(result.current.isGenerating).toBe(false)
  })

  it("records skipped slots from a completed job poll", async () => {
    startWorksheetGenerationJobAction.mockResolvedValue({
      ok: true,
      data: { jobId, worksheetId },
    })
    getGenerationJobAction.mockResolvedValue({
      ok: true,
      data: terminalPoll({
        questions: [questionAtOrder(1)],
        skippedSlots: [{ order: 2, message: "Could not generate the question." }],
        statusMessage: "Finished with 1 skipped question.",
      }),
    })

    const { result } = renderHook(() => useWorksheetGenerator())

    await act(async () => {
      await result.current.startGeneration(generateInput)
    })

    expect(result.current.questions).toHaveLength(1)
    expect(result.current.skippedSlots).toEqual([
      { order: 2, message: "Could not generate the question." },
    ])
    expect(result.current.statusMessage).toBe("Finished with 1 skipped question.")
  })

  it("replaceQuestion updates a question and keeps sort order", async () => {
    startWorksheetGenerationJobAction.mockResolvedValue({
      ok: true,
      data: { jobId, worksheetId },
    })
    getGenerationJobAction.mockResolvedValue({
      ok: true,
      data: terminalPoll({
        questions: [questionAtOrder(1)],
        toOrder: 1,
        progress: { current: 1, total: 1 },
      }),
    })

    const { result } = renderHook(() => useWorksheetGenerator())

    await act(async () => {
      await result.current.startGeneration({ ...generateInput, question_count: 1 })
    })

    await act(async () => {
      result.current.replaceQuestion({
        ...questionAtOrder(1),
        question_text: "Updated question text",
      })
    })

    expect(result.current.questions).toHaveLength(1)
    expect(result.current.questions[0]?.question_text).toBe("Updated question text")
    expect(result.current.questions[0]?.order).toBe(1)
  })

  it("returns ok with newQuestionCount when credits run out after extend", async () => {
    startAppendGenerationJobAction.mockResolvedValue({
      ok: true,
      data: { jobId, worksheetId, newQuestionCount: 25 },
    })
    getGenerationJobAction.mockResolvedValue({
      ok: true,
      data: terminalPoll({
        status: "partial",
        toOrder: 25,
        progress: { current: 20, total: 25 },
        stoppedForCredits: true,
        isTerminal: true,
        statusMessage: "Generation stopped because you do not have enough credits.",
      }),
    })

    const { result } = renderHook(() => useWorksheetGenerator())

    const startingQuestions = Array.from({ length: 20 }, (_, index) => ({
      ...validWorksheetQuestion,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      order: index + 1,
    }))

    let appendResult: Awaited<ReturnType<typeof result.current.appendQuestions>> | undefined

    await act(async () => {
      appendResult = await result.current.appendQuestions(worksheetId, 5, {
        questions: startingQuestions,
        skippedSlots: [],
      })
    })

    expect(appendResult).toEqual({
      ok: true,
      newQuestionCount: 25,
      stoppedForCredits: true,
    })
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.targetQuestionCount).toBe(25)
    expect(startAppendGenerationJobAction).toHaveBeenCalledWith({
      worksheetId,
      additionalCount: 5,
    })
    expect(getWorksheetQuestionCountAction).toHaveBeenCalledWith(worksheetId)
  })

  it("rejects append when worksheet id or count is invalid", async () => {
    const { result } = renderHook(() => useWorksheetGenerator())

    let emptyIdResult: Awaited<ReturnType<typeof result.current.appendQuestions>> | undefined
    let zeroCountResult: Awaited<ReturnType<typeof result.current.appendQuestions>> | undefined

    await act(async () => {
      emptyIdResult = await result.current.appendQuestions("", 3, {
        questions: [],
        skippedSlots: [],
      })
      zeroCountResult = await result.current.appendQuestions(worksheetId, 0, {
        questions: [],
        skippedSlots: [],
      })
    })

    expect(emptyIdResult).toEqual({ ok: false })
    expect(zeroCountResult).toEqual({ ok: false })
    expect(startAppendGenerationJobAction).not.toHaveBeenCalled()
  })

  it("rejects append while generation is already running", async () => {
    let resolveStart: (value: { ok: true; data: { jobId: string; worksheetId: string } }) => void
    startWorksheetGenerationJobAction.mockReturnValue(
      new Promise((resolve) => {
        resolveStart = resolve
      })
    )
    getGenerationJobAction.mockImplementation(
      () =>
        new Promise(() => {
          /* keep polling */
        })
    )

    const { result } = renderHook(() => useWorksheetGenerator())

    let appendDuringGeneration: Awaited<ReturnType<typeof result.current.appendQuestions>> | undefined

    act(() => {
      void result.current.startGeneration(generateInput)
    })

    await act(async () => {
      appendDuringGeneration = await result.current.appendQuestions(worksheetId, 2, {
        questions: [],
        skippedSlots: [],
      })
    })

    expect(appendDuringGeneration).toEqual({ ok: false })

    await act(async () => {
      resolveStart!({ ok: true, data: { jobId, worksheetId } })
    })
  })

  it("resumeActiveJob polls an active job for the worksheet", async () => {
    getActiveGenerationJobForWorksheetAction.mockResolvedValue({
      ok: true,
      data: { jobId },
    })

    const { result } = renderHook(() => useWorksheetGenerator())

    await act(async () => {
      await result.current.resumeActiveJob(worksheetId)
    })

    expect(getActiveGenerationJobForWorksheetAction).toHaveBeenCalledWith(worksheetId)
    expect(getGenerationJobAction).toHaveBeenCalledWith(jobId)
    expect(result.current.isGenerating).toBe(false)
  })
})

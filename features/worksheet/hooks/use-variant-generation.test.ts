import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { GenerationJobPollResult } from "@/features/generate/generation-job-types"
import type { WorksheetVariant } from "@/features/generate/types"
import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

const startVariantGenerationJobAction = vi.fn()
const getVariantGenerationJobAction = vi.fn()
const saveWorksheetVariantsAction = vi.fn()

vi.mock("@/features/generate/variant-actions", () => ({
  startVariantGenerationJobAction: (...args: unknown[]) => startVariantGenerationJobAction(...args),
  getVariantGenerationJobAction: (...args: unknown[]) => getVariantGenerationJobAction(...args),
  saveWorksheetVariantsAction: (...args: unknown[]) => saveWorksheetVariantsAction(...args),
}))

import { useVariantGeneration } from "./use-variant-generation"

const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
const jobId = "b1b2c3d4-e5f6-4789-a012-3456789abcde"
const questionCount = 2

const generatedVariant: WorksheetVariant = {
  id: "22222222-2222-4222-8222-222222222222",
  label: "B",
  createdAt: "2026-06-21T00:00:00.000Z",
  rolls: [
    {
      order: 1,
      given_values: validWorksheetQuestion.given_values,
      solution: validWorksheetQuestion.solution,
    },
    {
      order: 2,
      given_values: validWorksheetQuestion.given_values,
      solution: validWorksheetQuestion.solution,
    },
  ],
}

function variantPoll(overrides: Partial<GenerationJobPollResult> = {}): GenerationJobPollResult {
  return {
    jobId,
    worksheetId,
    status: "completed",
    kind: "variant",
    fromOrder: 1,
    toOrder: 2,
    lastCompletedOrder: 2,
    targetQuestionCount: 2,
    progress: { current: 2, total: 2 },
    questions: [validWorksheetQuestion],
    skippedSlots: [],
    statusMessage: "Variant generation complete.",
    creditBalance: 12,
    isTerminal: true,
    stoppedForCredits: false,
    variants: [generatedVariant],
    variantProgress: { current: 2, total: 2 },
    ...overrides,
  }
}

function defaultHookParams(overrides: Partial<Parameters<typeof useVariantGeneration>[0]> = {}) {
  return {
    worksheetId,
    questionCount,
    isWorksheetComplete: true,
    ...overrides,
  }
}

describe("useVariantGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    startVariantGenerationJobAction.mockResolvedValue({
      ok: true,
      data: { jobId, worksheetId, labels: ["B"] as const },
    })
    getVariantGenerationJobAction.mockResolvedValue({
      ok: true,
      data: variantPoll(),
    })
    saveWorksheetVariantsAction.mockResolvedValue({ ok: true, data: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("starts a job, polls until complete, and calls onVariantsGenerated", async () => {
    const onCreditBalanceUpdated = vi.fn()
    const onVariantsGenerated = vi.fn()

    let resolveStart: (value: {
      ok: true
      data: { jobId: string; worksheetId: string; labels: ["B"] }
    }) => void

    startVariantGenerationJobAction.mockReturnValue(
      new Promise((resolve) => {
        resolveStart = resolve
      })
    )

    getVariantGenerationJobAction
      .mockResolvedValueOnce({
        ok: true,
        data: variantPoll({
          isTerminal: false,
          status: "running",
          statusMessage: "Generating variants...",
          variantProgress: { current: 1, total: 4 },
          variants: undefined,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: variantPoll(),
      })

    const { result } = renderHook(() =>
      useVariantGeneration({
        ...defaultHookParams(),
        onCreditBalanceUpdated,
        onVariantsGenerated,
      })
    )

    act(() => {
      void result.current.startVariantGeneration(1)
    })

    expect(result.current.isGeneratingVariants).toBe(true)
    expect(result.current.variantProgress).toEqual({ current: 0, total: 2 })

    await act(async () => {
      resolveStart!({
        ok: true,
        data: { jobId, worksheetId, labels: ["B"] },
      })
      await Promise.resolve()
    })

    expect(result.current.variantProgress).toEqual({ current: 1, total: 4 })
    expect(onCreditBalanceUpdated).toHaveBeenCalledWith(12)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    expect(onVariantsGenerated).toHaveBeenCalledWith([generatedVariant])
    expect(result.current.isGeneratingVariants).toBe(false)
    expect(result.current.variantProgress).toBeNull()
    expect(result.current.variantStatusMessage).toBe("Variant generation complete.")
    expect(startVariantGenerationJobAction).toHaveBeenCalledWith({
      worksheetId,
      additionalCount: 1,
    })
    expect(getVariantGenerationJobAction).toHaveBeenCalledTimes(2)
  })

  it("sets variantError when job start fails", async () => {
    startVariantGenerationJobAction.mockResolvedValue({
      ok: false,
      message: "Could not start variant generation.",
    })

    const { result } = renderHook(() => useVariantGeneration(defaultHookParams()))

    await act(async () => {
      await result.current.startVariantGeneration(1)
    })

    expect(result.current.variantError).toBe("Could not start variant generation.")
    expect(result.current.isGeneratingVariants).toBe(false)
    expect(getVariantGenerationJobAction).not.toHaveBeenCalled()
  })

  it("sets variantError when poll returns not ok", async () => {
    getVariantGenerationJobAction.mockResolvedValue({
      ok: false,
      code: "UNKNOWN",
      message: "Generation job not found.",
    })

    const { result } = renderHook(() => useVariantGeneration(defaultHookParams()))

    await act(async () => {
      await result.current.startVariantGeneration(1)
    })

    expect(result.current.variantError).toBe("Generation job not found.")
    expect(result.current.isGeneratingVariants).toBe(false)
  })

  it("sets variantError when terminal poll status is failed", async () => {
    getVariantGenerationJobAction.mockResolvedValue({
      ok: true,
      data: variantPoll({
        status: "failed",
        statusMessage: "Variant generation failed.",
        variants: [],
      }),
    })

    const onVariantsGenerated = vi.fn()
    const { result } = renderHook(() =>
      useVariantGeneration({
        ...defaultHookParams(),
        onVariantsGenerated,
      })
    )

    await act(async () => {
      await result.current.startVariantGeneration(1)
    })

    expect(result.current.variantError).toBe("Variant generation failed.")
    expect(onVariantsGenerated).not.toHaveBeenCalled()
  })

  it("saves variants successfully", async () => {
    const { result } = renderHook(() => useVariantGeneration(defaultHookParams()))

    let saveResult: Awaited<ReturnType<typeof result.current.saveVariants>> | undefined

    await act(async () => {
      saveResult = await result.current.saveVariants([generatedVariant])
    })

    expect(saveResult).toEqual({ ok: true, data: null })
    expect(result.current.variantError).toBeNull()
    expect(result.current.isSavingVariants).toBe(false)
    expect(saveWorksheetVariantsAction).toHaveBeenCalledWith({
      worksheetId,
      variants: [generatedVariant],
    })
  })

  it("sets variantError when save fails", async () => {
    saveWorksheetVariantsAction.mockResolvedValue({
      ok: false,
      message: "Could not save variants.",
    })

    const { result } = renderHook(() => useVariantGeneration(defaultHookParams()))

    await act(async () => {
      await result.current.saveVariants([generatedVariant])
    })

    expect(result.current.variantError).toBe("Could not save variants.")
    expect(result.current.isSavingVariants).toBe(false)
  })

  it("clears the poll timer on unmount", async () => {
    getVariantGenerationJobAction.mockResolvedValue({
      ok: true,
      data: variantPoll({
        isTerminal: false,
        status: "running",
        statusMessage: "Generating variants...",
        variantProgress: { current: 1, total: 4 },
      }),
    })

    const { result, unmount } = renderHook(() => useVariantGeneration(defaultHookParams()))

    await act(async () => {
      void result.current.startVariantGeneration(1)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(getVariantGenerationJobAction).toHaveBeenCalledTimes(1)

    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    expect(getVariantGenerationJobAction).toHaveBeenCalledTimes(1)
  })

  it("does not start when the worksheet is incomplete", async () => {
    const { result } = renderHook(() =>
      useVariantGeneration({
        ...defaultHookParams(),
        isWorksheetComplete: false,
      })
    )

    await act(async () => {
      await result.current.startVariantGeneration(1)
    })

    expect(startVariantGenerationJobAction).not.toHaveBeenCalled()
    expect(getVariantGenerationJobAction).not.toHaveBeenCalled()
    expect(result.current.isGeneratingVariants).toBe(false)
  })
})

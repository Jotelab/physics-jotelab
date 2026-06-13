import { describe, expect, it, vi } from "vitest"

import type { GenerationJobPollResult } from "@/features/generate/generation-job-types"

import { runGenerationJob } from "./run-generation-job"

const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
const jobId = "b1b2c3d4-e5f6-4789-a012-3456789abcde"

function terminalPoll(): GenerationJobPollResult {
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
    questions: [],
    skippedSlots: [],
    statusMessage: "Worksheet complete.",
    creditBalance: 8,
    isTerminal: true,
    stoppedForCredits: false,
  }
}

describe("runGenerationJob", () => {
  it("aborts polling, starts the job, polls until terminal, and syncs target count", async () => {
    const abortPoll = vi.fn()
    const pollUntilTerminal = vi.fn().mockResolvedValue(terminalPoll())
    const syncTargetQuestionCount = vi.fn().mockResolvedValue(null)

    const result = await runGenerationJob({
      abortPoll,
      startJob: () =>
        Promise.resolve({
          ok: true,
          data: { jobId, worksheetId },
        }),
      pollUntilTerminal,
      syncTargetQuestionCount,
      startNetworkErrorMessage: "network",
    })

    expect(abortPoll).toHaveBeenCalledOnce()
    expect(pollUntilTerminal).toHaveBeenCalledWith(jobId)
    expect(syncTargetQuestionCount).toHaveBeenCalledWith(worksheetId)
    expect(result).toEqual({
      ok: true,
      terminal: terminalPoll(),
      startData: { jobId, worksheetId },
    })
  })

  it("returns start_network_error when start throws", async () => {
    const result = await runGenerationJob({
      abortPoll: vi.fn(),
      startJob: () => Promise.reject(new Error("down")),
      pollUntilTerminal: vi.fn(),
      syncTargetQuestionCount: vi.fn(),
      startNetworkErrorMessage: "Could not start.",
    })

    expect(result).toEqual({
      ok: false,
      reason: "start_network_error",
      message: "Could not start.",
    })
  })

  it("returns start_failed when start returns an action failure", async () => {
    const result = await runGenerationJob({
      abortPoll: vi.fn(),
      startJob: () =>
        Promise.resolve({
          ok: false,
          code: "UNKNOWN",
          message: "Could not start worksheet generation.",
        }),
      pollUntilTerminal: vi.fn(),
      syncTargetQuestionCount: vi.fn(),
      startNetworkErrorMessage: "network",
    })

    expect(result).toEqual({
      ok: false,
      reason: "start_failed",
      message: "Could not start worksheet generation.",
    })
  })

  it("returns poll_failed when polling does not reach a terminal state", async () => {
    const result = await runGenerationJob({
      abortPoll: vi.fn(),
      startJob: () =>
        Promise.resolve({
          ok: true,
          data: { jobId, worksheetId },
        }),
      pollUntilTerminal: vi.fn().mockResolvedValue(null),
      syncTargetQuestionCount: vi.fn(),
      startNetworkErrorMessage: "network",
    })

    expect(result).toEqual({ ok: false, reason: "poll_failed" })
  })

  it("calls onJobStarted after a successful start and before polling", async () => {
    const onJobStarted = vi.fn()
    const pollUntilTerminal = vi.fn().mockResolvedValue(terminalPoll())

    await runGenerationJob({
      abortPoll: vi.fn(),
      startJob: () =>
        Promise.resolve({
          ok: true,
          data: { jobId, worksheetId },
        }),
      onJobStarted,
      pollUntilTerminal,
      syncTargetQuestionCount: vi.fn(),
      startNetworkErrorMessage: "network",
    })

    expect(onJobStarted).toHaveBeenCalledWith({ jobId, worksheetId })
    expect(onJobStarted.mock.invocationCallOrder[0]).toBeLessThan(
      pollUntilTerminal.mock.invocationCallOrder[0]!
    )
  })

  it("returns unmounted when the caller is no longer mounted after sync", async () => {
    const result = await runGenerationJob({
      abortPoll: vi.fn(),
      startJob: () =>
        Promise.resolve({
          ok: true,
          data: { jobId, worksheetId },
        }),
      pollUntilTerminal: vi.fn().mockResolvedValue(terminalPoll()),
      syncTargetQuestionCount: vi.fn(),
      startNetworkErrorMessage: "network",
      isMounted: () => false,
    })

    expect(result).toEqual({ ok: false, reason: "unmounted" })
  })
})

import { describe, expect, it } from "vitest"

import type { GenerationJobRow } from "../generation-job-types"
import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

import {
  buildGenerationJobStatusMessage,
  mapGenerationJobPoll,
} from "./map-generation-job-poll"

const baseJob: GenerationJobRow = {
  id: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
  user_id: "11111111-1111-4111-8111-111111111111",
  worksheet_id: "22222222-2222-4222-8222-222222222222",
  kind: "initial",
  status: "running",
  from_order: 1,
  to_order: 3,
  last_completed_order: 1,
  skipped_orders: [],
  error_message: null,
  inngest_run_id: null,
  variant_labels: null,
  variant_results: { variants: [] },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

function questionAtOrder(order: number) {
  return {
    ...validWorksheetQuestion,
    id: `00000000-0000-4000-8000-${String(order).padStart(12, "0")}`,
    order,
  }
}

describe("buildGenerationJobStatusMessage", () => {
  it("returns queued message", () => {
    expect(
      buildGenerationJobStatusMessage({ ...baseJob, status: "queued", last_completed_order: null })
    ).toBe("Waiting to start generation...")
  })

  it("returns failed message", () => {
    expect(buildGenerationJobStatusMessage({ ...baseJob, status: "failed" })).toContain("failed")
  })

  it("returns cancelled message", () => {
    expect(buildGenerationJobStatusMessage({ ...baseJob, status: "cancelled" })).toBe(
      "Generation was cancelled."
    )
  })

  it("returns complete message without skips", () => {
    expect(buildGenerationJobStatusMessage({ ...baseJob, status: "completed" })).toBe(
      "Worksheet complete."
    )
  })

  it("returns singular skipped message for one skip", () => {
    expect(
      buildGenerationJobStatusMessage({
        ...baseJob,
        status: "completed",
        skipped_orders: [{ order: 2, message: "Credit exhausted" }],
      })
    ).toBe("Finished with 1 skipped question.")
  })

  it("returns plural skipped message for multiple skips", () => {
    expect(
      buildGenerationJobStatusMessage({
        ...baseJob,
        status: "completed",
        skipped_orders: [
          { order: 2, message: "a" },
          { order: 3, message: "b" },
        ],
      })
    ).toBe("Finished with 2 skipped questions.")
  })
})

describe("mapGenerationJobPoll", () => {
  it("marks running jobs as non-terminal with progress text", () => {
    const poll = mapGenerationJobPoll({
      job: baseJob,
      questions: [validWorksheetQuestion],
      questionCount: 3,
      creditBalance: 10,
    })

    expect(poll.isTerminal).toBe(false)
    expect(poll.stoppedForCredits).toBe(false)
    expect(poll.statusMessage).toContain("Generating")
    expect(poll.progress).toEqual({ current: 1, total: 3 })
    expect(poll.creditBalance).toBe(10)
  })

  it("marks queued jobs as non-terminal", () => {
    const poll = mapGenerationJobPoll({
      job: { ...baseJob, status: "queued", last_completed_order: null },
      questions: [],
      questionCount: 3,
      creditBalance: 5,
    })

    expect(poll.isTerminal).toBe(false)
    expect(poll.stoppedForCredits).toBe(false)
    expect(poll.statusMessage).toBe("Waiting to start generation...")
  })

  it("marks failed jobs as terminal", () => {
    const poll = mapGenerationJobPoll({
      job: { ...baseJob, status: "failed" },
      questions: [],
      questionCount: 3,
      creditBalance: null,
    })

    expect(poll.isTerminal).toBe(true)
    expect(poll.stoppedForCredits).toBe(false)
    expect(poll.statusMessage).toContain("failed")
    expect(poll.creditBalance).toBeNull()
  })

  it("marks cancelled jobs as terminal", () => {
    const poll = mapGenerationJobPoll({
      job: { ...baseJob, status: "cancelled" },
      questions: [],
      questionCount: 3,
      creditBalance: 1,
    })

    expect(poll.isTerminal).toBe(true)
    expect(poll.statusMessage).toBe("Generation was cancelled.")
  })

  it("marks completed jobs with full progress and no skips", () => {
    const poll = mapGenerationJobPoll({
      job: { ...baseJob, status: "completed", last_completed_order: 3 },
      questions: [questionAtOrder(1), questionAtOrder(2), questionAtOrder(3)],
      questionCount: 3,
      creditBalance: 8,
    })

    expect(poll.isTerminal).toBe(true)
    expect(poll.stoppedForCredits).toBe(false)
    expect(poll.progress).toEqual({ current: 3, total: 3 })
    expect(poll.statusMessage).toBe("Worksheet complete.")
    expect(poll.skippedSlots).toEqual([])
  })

  it("marks completed jobs with skipped slots in status message", () => {
    const skipped = [{ order: 2, message: "Skipped" }]
    const poll = mapGenerationJobPoll({
      job: { ...baseJob, status: "completed", skipped_orders: skipped },
      questions: [questionAtOrder(1), questionAtOrder(3)],
      questionCount: 3,
      creditBalance: 8,
    })

    expect(poll.skippedSlots).toEqual(skipped)
    expect(poll.statusMessage).toBe("Finished with 1 skipped question.")
  })

  it("ignores invalid skipped_orders payloads", () => {
    const poll = mapGenerationJobPoll({
      job: { ...baseJob, status: "completed", skipped_orders: "not-json" },
      questions: [],
      questionCount: 3,
      creditBalance: null,
    })

    expect(poll.skippedSlots).toEqual([])
    expect(poll.statusMessage).toBe("Worksheet complete.")
  })

  it("uses unfilled order in running status message when questions have gaps", () => {
    const poll = mapGenerationJobPoll({
      job: { ...baseJob, status: "running", last_completed_order: 1, to_order: 3 },
      questions: [questionAtOrder(1)],
      questionCount: 3,
      creditBalance: 10,
    })

    expect(poll.isTerminal).toBe(false)
    expect(poll.statusMessage).toBe("Generating 2/3...")
  })

  it("uses first unfilled order when no questions exist yet", () => {
    const poll = mapGenerationJobPoll({
      job: {
        ...baseJob,
        status: "running",
        last_completed_order: 0,
        to_order: 5,
      },
      questions: [],
      questionCount: 5,
      creditBalance: 10,
    })

    expect(poll.statusMessage).toBe("Generating 1/5...")
    expect(poll.progress.current).toBe(0)
  })

  it("marks partial jobs as terminal with credit stop flag", () => {
    const poll = mapGenerationJobPoll({
      job: { ...baseJob, status: "partial" },
      questions: [],
      questionCount: 3,
      creditBalance: 0,
    })

    expect(poll.isTerminal).toBe(true)
    expect(poll.stoppedForCredits).toBe(true)
    expect(poll.statusMessage).toBe(
      "Generation stopped because you do not have enough credits."
    )
  })

  it("maps variant jobs with roll progress", () => {
    const poll = mapGenerationJobPoll({
      job: {
        ...baseJob,
        kind: "variant",
        status: "running",
        to_order: 1,
        variant_labels: ["B", "C"],
        last_completed_order: 2,
        variant_results: { variants: [] },
      },
      questions: [questionAtOrder(1)],
      questionCount: 1,
      creditBalance: 4,
    })

    expect(poll.variantProgress).toEqual({ current: 2, total: 2 })
    expect(poll.statusMessage).toContain("variants")
    expect(poll.skippedSlots).toEqual([])
  })
})

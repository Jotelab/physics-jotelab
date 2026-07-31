import { beforeEach, describe, expect, it, vi } from "vitest"

import { failure } from "@/features/generate/errors"
import type { GenerationJobRow } from "@/features/generate/generation-job-types"
import type { WorksheetQuestion } from "@/features/generate/types"
import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }))
vi.mock("@/lib/supabase/user-client", () => ({
  createClientForProfile: vi.fn(async () => ({})),
}))
vi.mock("@/features/generate/generate-question-core", () => ({
  generateQuestionForWorksheet: vi.fn(),
  loadWorksheetQuestionsForProfile: vi.fn(),
}))
vi.mock("@/features/generate/generate-variant-core", () => ({
  generateVariantRollForQuestion: vi.fn(),
}))

import { createServiceRoleClient } from "@/lib/supabase/admin"
import { createClientForProfile } from "@/lib/supabase/user-client"
import {
  generateQuestionForWorksheet,
  loadWorksheetQuestionsForProfile,
} from "@/features/generate/generate-question-core"
import { runGenerationJobWorker } from "./run-generation-job-worker"

const jobId = "b1b2c3d4-e5f6-4789-a012-3456789abcde"
const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
const profileId = "11111111-1111-4111-8111-111111111111"

type RpcCall = { name: string; params: Record<string, unknown> }

function makeAdmin(opts: { kindRow?: unknown; jobRow?: unknown }) {
  const rpcCalls: RpcCall[] = []
  const admin = {
    rpc: vi.fn(async (name: string, params: Record<string, unknown>) => {
      rpcCalls.push({ name, params })
      return { error: null }
    }),
    from: vi.fn(() => {
      let sel = ""
      const chain: Record<string, unknown> = {
        select: vi.fn((s: string) => {
          sel = s
          return chain
        }),
        eq: vi.fn(() => chain),
        single: vi.fn(async () =>
          sel === "*"
            ? { data: opts.jobRow ?? null, error: opts.jobRow ? null : { message: "not found" } }
            : { data: opts.kindRow ?? null, error: opts.kindRow ? null : { message: "not found" } }
        ),
      }
      return chain
    }),
  }
  return { admin, rpcCalls }
}

function makeJobRow(overrides: Partial<GenerationJobRow> = {}): GenerationJobRow {
  return {
    id: jobId,
    user_id: profileId,
    worksheet_id: worksheetId,
    kind: "initial",
    status: "queued",
    from_order: 1,
    to_order: 2,
    last_completed_order: null,
    skipped_orders: null,
    error_message: null,
    inngest_run_id: null,
    variant_labels: null,
    variant_results: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function recordingStep() {
  const names: string[] = []
  return {
    names,
    step: {
      run: async <T>(name: string, fn: () => Promise<T>) => {
        names.push(name)
        return fn()
      },
    },
  }
}

const mockLoad = vi.mocked(loadWorksheetQuestionsForProfile)
const mockGenerate = vi.mocked(generateQuestionForWorksheet)
const mockAdminFactory = vi.mocked(createServiceRoleClient)
const mockUserClient = vi.mocked(createClientForProfile)

function progressUpdates(rpcCalls: RpcCall[]) {
  return rpcCalls
    .filter((call) => call.name === "update_generation_job_progress")
    .map((call) => call.params)
}

function worksheetLoad(questions: WorksheetQuestion[]) {
  return {
    worksheet: {
      id: worksheetId,
      user_id: profileId,
      subject: "physics" as const,
      question_count: 2,
      generation_settings: {},
    },
    questions,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUserClient.mockResolvedValue({} as never)
})

describe("runGenerationJobWorker (standard)", () => {
  it("generates every unfilled order and finalizes completed", async () => {
    const { admin, rpcCalls } = makeAdmin({
      kindRow: { kind: "initial", user_id: profileId },
      jobRow: makeJobRow(),
    })
    mockAdminFactory.mockReturnValue(admin as never)

    const store: WorksheetQuestion[] = []
    mockLoad.mockImplementation(async () => worksheetLoad([...store]) as never)
    mockGenerate.mockImplementation(async ({ order }) => {
      const question = { ...validWorksheetQuestion, id: `q-${order}`, order }
      store.push(question)
      return { ok: true, data: { question, creditBalance: 50 - order } }
    })

    const { step, names } = recordingStep()
    const result = await runGenerationJobWorker({ jobId, worksheetId, profileId, runId: "run-1", step })

    expect(result).toEqual({ status: "completed" })
    const updates = progressUpdates(rpcCalls)
    expect(updates.map((u) => u.p_status)).toEqual(["running", "running", "running", "completed"])
    expect(updates[0]).toMatchObject({ p_status: "running", p_inngest_run_id: "run-1" })
    expect(updates.at(-1)).toMatchObject({ p_status: "completed", p_last_completed_order: 2 })
    expect(names).toEqual([
      "resolve-job-kind",
      "mark-running",
      "load-job",
      "load-worksheet",
      "generate-order-1",
      "persist-progress-1",
      "generate-order-2",
      "persist-progress-2",
      "finalize",
    ])
    expect(mockGenerate).toHaveBeenCalledTimes(2)
    // Context read only — the worker must not pay WASM TeX diagram compiles.
    expect(mockLoad).toHaveBeenCalledWith(
      expect.anything(),
      worksheetId,
      profileId,
      { attachDiagrams: false }
    )
  })

  it("stops at partial and marks remaining orders skipped when credits run out", async () => {
    const { admin, rpcCalls } = makeAdmin({
      kindRow: { kind: "initial", user_id: profileId },
      jobRow: makeJobRow(),
    })
    mockAdminFactory.mockReturnValue(admin as never)

    const store: WorksheetQuestion[] = []
    mockLoad.mockImplementation(async () => worksheetLoad([...store]) as never)
    mockGenerate.mockImplementation(async ({ order }) => {
      if (order === 2) {
        return failure("INSUFFICIENT_CREDITS")
      }
      const question = { ...validWorksheetQuestion, id: `q-${order}`, order }
      store.push(question)
      return { ok: true, data: { question, creditBalance: 0 } }
    })

    const { step } = recordingStep()
    const result = await runGenerationJobWorker({ jobId, worksheetId, profileId, step })

    expect(result).toEqual({ status: "partial" })
    const final = progressUpdates(rpcCalls).at(-1)
    expect(final).toMatchObject({ p_status: "partial", p_last_completed_order: 1 })
    expect(final?.p_skipped_orders).toEqual([
      { order: 2, message: "Question 2 was skipped because you do not have enough credits." },
    ])
  })

  it("records a non-credit failure as a skipped slot and still completes", async () => {
    const { admin, rpcCalls } = makeAdmin({
      kindRow: { kind: "initial", user_id: profileId },
      jobRow: makeJobRow(),
    })
    mockAdminFactory.mockReturnValue(admin as never)

    const store: WorksheetQuestion[] = []
    mockLoad.mockImplementation(async () => worksheetLoad([...store]) as never)
    mockGenerate.mockImplementation(async ({ order }) => {
      if (order === 2) {
        return failure("VALIDATION_FAILED", "bad shape")
      }
      const question = { ...validWorksheetQuestion, id: `q-${order}`, order }
      store.push(question)
      return { ok: true, data: { question, creditBalance: 5 } }
    })

    const { step } = recordingStep()
    const result = await runGenerationJobWorker({ jobId, worksheetId, profileId, step })

    expect(result).toEqual({ status: "completed" })
    const final = progressUpdates(rpcCalls).at(-1)
    expect(final).toMatchObject({ p_status: "completed" })
    // The failure code rides along so the client can localize the skip.
    expect(final?.p_skipped_orders).toEqual([
      { order: 2, message: "bad shape", code: "VALIDATION_FAILED" },
    ])
  })

  it("fails the job when the worksheet cannot be loaded at all", async () => {
    const { admin, rpcCalls } = makeAdmin({
      kindRow: { kind: "initial", user_id: profileId },
      jobRow: makeJobRow(),
    })
    mockAdminFactory.mockReturnValue(admin as never)
    mockLoad.mockResolvedValue(null)

    const { step, names } = recordingStep()
    const result = await runGenerationJobWorker({ jobId, worksheetId, profileId, step })

    expect(result).toEqual({ status: "failed" })
    expect(names).toContain("fail-missing-worksheet")
    expect(progressUpdates(rpcCalls).at(-1)).toMatchObject({
      p_status: "failed",
      p_error_message: "Worksheet not found",
    })
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it("fails the job when generation reports the worksheet is gone", async () => {
    const { admin, rpcCalls } = makeAdmin({
      kindRow: { kind: "initial", user_id: profileId },
      jobRow: makeJobRow(),
    })
    mockAdminFactory.mockReturnValue(admin as never)
    mockLoad.mockResolvedValue(worksheetLoad([]) as never) // load-worksheet succeeds
    // The worker no longer re-reads per order; the core's ownership load is the
    // authoritative check, surfaced as WORKSHEET_ACCESS_DENIED.
    mockGenerate.mockResolvedValue(failure("WORKSHEET_ACCESS_DENIED"))

    const { step, names } = recordingStep()
    const result = await runGenerationJobWorker({ jobId, worksheetId, profileId, step })

    expect(result).toEqual({ status: "failed" })
    expect(names).toContain("fail-job")
    expect(progressUpdates(rpcCalls).at(-1)).toMatchObject({
      p_status: "failed",
      p_error_message: "You do not have access to this worksheet.",
    })
  })

  it("impersonates the authoritative job owner, not the caller-supplied profileId", async () => {
    const authoritativeOwner = "99999999-9999-4999-8999-999999999999"
    const { admin } = makeAdmin({
      kindRow: { kind: "initial", user_id: authoritativeOwner },
      jobRow: makeJobRow({ user_id: authoritativeOwner, to_order: 1 }),
    })
    mockAdminFactory.mockReturnValue(admin as never)

    const store: WorksheetQuestion[] = []
    mockLoad.mockImplementation(async () => worksheetLoad([...store]) as never)
    mockGenerate.mockImplementation(async ({ order }) => {
      const question = { ...validWorksheetQuestion, id: `q-${order}`, order }
      store.push(question)
      return { ok: true, data: { question, creditBalance: 1 } }
    })

    const { step } = recordingStep()
    await runGenerationJobWorker({ jobId, worksheetId, profileId: "spoofed-profile", step })

    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ profileId: authoritativeOwner }))
    expect(mockUserClient).toHaveBeenCalledWith(authoritativeOwner)
    expect(mockUserClient).not.toHaveBeenCalledWith("spoofed-profile")
  })

  it("retries a transient failure and saves on the second attempt", async () => {
    const { admin, rpcCalls } = makeAdmin({
      kindRow: { kind: "initial", user_id: profileId },
      jobRow: makeJobRow({ to_order: 1 }),
    })
    mockAdminFactory.mockReturnValue(admin as never)

    const store: WorksheetQuestion[] = []
    mockLoad.mockImplementation(async () => worksheetLoad([...store]) as never)
    let attempts = 0
    mockGenerate.mockImplementation(async ({ order }) => {
      attempts += 1
      if (attempts === 1) {
        return failure("GENERATE_FAILED")
      }
      const question = { ...validWorksheetQuestion, id: `q-${order}`, order }
      store.push(question)
      return { ok: true, data: { question, creditBalance: 3 } }
    })

    vi.useFakeTimers()
    try {
      const { step } = recordingStep()
      const promise = runGenerationJobWorker({ jobId, worksheetId, profileId, step })
      await vi.advanceTimersByTimeAsync(1000)
      const result = await promise

      expect(result).toEqual({ status: "completed" })
      expect(mockGenerate).toHaveBeenCalledTimes(2)
      expect(progressUpdates(rpcCalls).at(-1)).toMatchObject({ p_status: "completed", p_last_completed_order: 1 })
    } finally {
      vi.useRealTimers()
    }
  })
})

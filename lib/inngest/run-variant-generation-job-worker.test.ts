import { beforeEach, describe, expect, it, vi } from "vitest"

import { failure } from "@/features/generate/errors"
import type { GenerationJobRow } from "@/features/generate/generation-job-types"
import type { VariantQuestionRoll, WorksheetVariant } from "@/features/generate/types"
import { deriveVariantId } from "@/features/generate/utils/variant-identity"
import { validVariantRoll } from "@/tests/fixtures/worksheet-question"

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
import { loadWorksheetQuestionsForProfile } from "@/features/generate/generate-question-core"
import { generateVariantRollForQuestion } from "@/features/generate/generate-variant-core"
import { runVariantGenerationJobWorker } from "./run-variant-generation-job-worker"
import { runGenerationJobWorker } from "./run-generation-job-worker"

const jobId = "b1b2c3d4-e5f6-4789-a012-3456789abcde"
const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
const profileId = "11111111-1111-4111-8111-111111111111"
const createdAt = "2026-01-01T00:00:00.000Z"

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

function makeVariantJobRow(overrides: Partial<GenerationJobRow> = {}): GenerationJobRow {
  return {
    id: jobId,
    user_id: profileId,
    worksheet_id: worksheetId,
    kind: "variant",
    status: "queued",
    from_order: 1,
    to_order: 2,
    last_completed_order: null,
    skipped_orders: null,
    error_message: null,
    inngest_run_id: null,
    variant_labels: ["B"],
    variant_results: null,
    created_at: createdAt,
    updated_at: createdAt,
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
const mockVariant = vi.mocked(generateVariantRollForQuestion)
const mockAdminFactory = vi.mocked(createServiceRoleClient)

function progressUpdates(rpcCalls: RpcCall[]) {
  return rpcCalls
    .filter((call) => call.name === "update_generation_job_progress")
    .map((call) => call.params)
}

function rollFor(order: number): VariantQuestionRoll {
  return { ...validVariantRoll, order }
}

beforeEach(() => {
  vi.clearAllMocks()
  // The variant worker ignores worksheet questions but load-worksheet must succeed.
  mockLoad.mockResolvedValue({
    worksheet: {
      id: worksheetId,
      user_id: profileId,
      subject: "physics",
      question_count: 2,
      generation_settings: {},
    },
    questions: [],
  } as never)
})

describe("runVariantGenerationJobWorker", () => {
  it("rolls every label/order and finalizes completed with variant results", async () => {
    const { admin, rpcCalls } = makeAdmin({ jobRow: makeVariantJobRow() })
    mockAdminFactory.mockReturnValue(admin as never)
    mockVariant.mockImplementation(async ({ order }) => ({
      ok: true,
      data: { roll: rollFor(order), creditBalance: 10 - order },
    }))

    const { step, names } = recordingStep()
    const result = await runVariantGenerationJobWorker({ jobId, worksheetId, profileId, step })

    expect(result).toMatchObject({ status: "completed", totalRolls: 2, completedRolls: 2 })
    const variants = (result as { variants: WorksheetVariant[] }).variants
    expect(variants).toHaveLength(1)
    expect(variants[0]).toMatchObject({ id: deriveVariantId(jobId, "B"), label: "B" })
    expect(variants[0].rolls.map((r) => r.order)).toEqual([1, 2])
    expect(names).toContain("variant-B-1")
    expect(names).toContain("persist-variant-B-2")
    expect(names).toContain("finalize-variant")

    const final = progressUpdates(rpcCalls).at(-1)
    expect(final).toMatchObject({ p_status: "completed", p_last_completed_order: 2 })
    expect(final?.p_variant_results).toMatchObject({ variants: [{ label: "B" }] })
  })

  it("stops at partial and marks the remaining rolls skipped when credits run out", async () => {
    const { admin, rpcCalls } = makeAdmin({ jobRow: makeVariantJobRow() })
    mockAdminFactory.mockReturnValue(admin as never)
    mockVariant.mockImplementation(async ({ order }) =>
      order === 2
        ? failure("INSUFFICIENT_CREDITS")
        : { ok: true, data: { roll: rollFor(order), creditBalance: 0 } }
    )

    const { step } = recordingStep()
    const result = await runVariantGenerationJobWorker({ jobId, worksheetId, profileId, step })

    expect(result).toMatchObject({ status: "partial", completedRolls: 1 })
    const final = progressUpdates(rpcCalls).at(-1)
    expect(final).toMatchObject({ p_status: "partial" })
    expect(final?.p_skipped_orders).toEqual([
      { label: "B", order: 2, message: "Not enough credits." },
    ])
  })

  it("records a non-credit failure as a skipped variant slot and completes", async () => {
    const { admin, rpcCalls } = makeAdmin({ jobRow: makeVariantJobRow() })
    mockAdminFactory.mockReturnValue(admin as never)
    mockVariant.mockImplementation(async ({ order }) =>
      order === 2
        ? failure("VARIANT_FAILED", "roll failed")
        : { ok: true, data: { roll: rollFor(order), creditBalance: 4 } }
    )

    const { step } = recordingStep()
    const result = await runVariantGenerationJobWorker({ jobId, worksheetId, profileId, step })

    expect(result).toMatchObject({ status: "completed", completedRolls: 1 })
    const final = progressUpdates(rpcCalls).at(-1)
    expect(final?.p_skipped_orders).toEqual([{ label: "B", order: 2, message: "roll failed" }])
  })

  it("does not re-roll an order that already has a persisted roll", async () => {
    const existing: WorksheetVariant = {
      id: deriveVariantId(jobId, "B"),
      label: "B",
      createdAt,
      rolls: [rollFor(1)],
    }
    const { admin } = makeAdmin({
      jobRow: makeVariantJobRow({ variant_results: { variants: [existing] }, last_completed_order: 1 }),
    })
    mockAdminFactory.mockReturnValue(admin as never)
    mockVariant.mockImplementation(async ({ order }) => ({
      ok: true,
      data: { roll: rollFor(order), creditBalance: 2 },
    }))

    const { step } = recordingStep()
    const result = await runVariantGenerationJobWorker({ jobId, worksheetId, profileId, step })

    expect(mockVariant).toHaveBeenCalledTimes(1)
    expect(mockVariant).toHaveBeenCalledWith(expect.objectContaining({ order: 2 }))
    expect(result).toMatchObject({ status: "completed" })
    expect((result as { variants: WorksheetVariant[] }).variants[0].rolls.map((r) => r.order)).toEqual([1, 2])
  })

  it("is reached through the dispatcher when the job kind is variant", async () => {
    const { admin, rpcCalls } = makeAdmin({
      kindRow: { kind: "variant", user_id: profileId },
      jobRow: makeVariantJobRow({ to_order: 1 }),
    })
    mockAdminFactory.mockReturnValue(admin as never)
    mockVariant.mockResolvedValue({ ok: true, data: { roll: rollFor(1), creditBalance: 1 } })

    const { step } = recordingStep()
    const result = await runGenerationJobWorker({ jobId, worksheetId, profileId, step })

    expect(mockVariant).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ status: "completed", totalRolls: 1 })
    expect(progressUpdates(rpcCalls).at(-1)).toMatchObject({ p_status: "completed" })
  })
})

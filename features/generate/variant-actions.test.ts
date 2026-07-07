import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

const mockGetUser = vi.fn()
const mockRpc = vi.fn()
const mockWorksheetsSingle = vi.fn()
const mockWorksheetQuestionsOrder = vi.fn()
const mockProfilesSingle = vi.fn()
const mockGenerationJobSingle = vi.fn()
const mockInngestSend = vi.fn()
const mockAdminRpc = vi.fn()
const mockAdminJobUpdate = vi.fn()
const mockAdminJobUpdateEq = vi.fn()
const mockRunGenerationJobWorker = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn((table: string) => {
      if (table === "worksheets") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockWorksheetsSingle,
            })),
          })),
        }
      }

      if (table === "worksheet_questions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: mockWorksheetQuestionsOrder,
            })),
          })),
        }
      }

      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockProfilesSingle,
            })),
          })),
        }
      }

      if (table === "generation_jobs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockGenerationJobSingle,
            })),
          })),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
    rpc: mockRpc,
  })),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: vi.fn(() => ({
    rpc: mockAdminRpc,
    from: vi.fn(() => ({
      update: (payload: unknown) => {
        mockAdminJobUpdate(payload)
        const chain = {
          eq: (column: string, value: unknown) => {
            mockAdminJobUpdateEq(column, value)
            return chain
          },
          then: (resolve: (result: { data: null; error: null }) => unknown) =>
            resolve({ data: null, error: null }),
        }
        return chain
      },
    })),
  })),
}))

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: (...args: unknown[]) => mockInngestSend(...args),
  },
}))

vi.mock("@/lib/inngest/run-generation-job-worker", () => ({
  runGenerationJobWorker: (...args: unknown[]) => mockRunGenerationJobWorker(...args),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import {
  getVariantGenerationJobAction,
  saveWorksheetVariantsAction,
  startVariantGenerationJobAction,
} from "./variant-actions"
import { failure } from "./errors"
import { revalidatePath } from "next/cache"
import type { GenerationJobRow } from "./generation-job-types"
import type { WorksheetVariant } from "./types"

const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
const jobId = "b1b2c3d4-e5f6-4789-a012-3456789abcde"
const profileId = "11111111-1111-4111-8111-111111111111"
const authUserId = "user-auth-1"

function makeSaveableVariant(
  overrides: Partial<WorksheetVariant> & { label?: WorksheetVariant["label"] } = {}
): WorksheetVariant {
  const label = overrides.label ?? "B"
  return {
    id: overrides.id ?? "22222222-2222-4222-8222-222222222222",
    label,
    createdAt: overrides.createdAt ?? "2026-06-21T00:00:00.000Z",
    rolls: overrides.rolls ?? [
      {
        order: 1,
        given_values: validWorksheetQuestion.given_values,
        solution: validWorksheetQuestion.solution,
      },
    ],
  }
}

function makeWorksheetQuestionRows(
  questions: typeof validWorksheetQuestion[] = []
) {
  return questions.map((question) => ({
    id: question.id,
    worksheet_id: worksheetId,
    question_order: question.order,
    question_text: question.question_text,
    given_values: question.given_values,
    target_variable: question.target_variable,
    solution: question.solution,
  }))
}

function mockWorksheetQuestions(questions: typeof validWorksheetQuestion[] = []) {
  mockWorksheetQuestionsOrder.mockResolvedValue({
    data: makeWorksheetQuestionRows(questions),
    error: null,
  })
}

function mockAuthenticatedWithProfile(creditBalance = 50) {
  mockGetUser.mockResolvedValue({ data: { user: { id: authUserId } } })
  mockProfilesSingle.mockResolvedValue({
    data: { id: profileId, credit_balance: creditBalance },
    error: null,
  })
}

function mockWorksheetVariants(variants: unknown) {
  mockWorksheetsSingle.mockResolvedValue({
    data: { variants },
    error: null,
  })
}

function mockEnqueueVariantJob(id: string = jobId) {
  mockRpc.mockImplementation(async (name: string) => {
    if (name === "enqueue_variant_generation_job") {
      return { data: id, error: null }
    }
    if (name === "save_worksheet_variants") {
      return { data: { success: true }, error: null }
    }
    throw new Error(`Unexpected rpc: ${name}`)
  })
}

function makeVariantJobRow(
  overrides: Partial<GenerationJobRow> = {}
): GenerationJobRow {
  return {
    id: jobId,
    user_id: profileId,
    worksheet_id: worksheetId,
    kind: "variant",
    status: "running",
    from_order: 1,
    to_order: 2,
    last_completed_order: 1,
    skipped_orders: [],
    error_message: null,
    inngest_run_id: null,
    variant_labels: ["B", "C"],
    variant_results: { variants: [] },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe("startVariantGenerationJobAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("INNGEST_EVENT_KEY", "test-key")
    vi.stubEnv("E2E_STUB_GENERATION", "")
    mockInngestSend.mockResolvedValue(undefined)
    mockRunGenerationJobWorker.mockResolvedValue(undefined)
    mockAdminRpc.mockResolvedValue({ data: null, error: null })
    mockAuthenticatedWithProfile()
    mockWorksheetVariants({ saved: [] })
    mockEnqueueVariantJob()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejects additionalCount 0 without calling auth", async () => {
    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 0,
    })

    expect(result).toEqual(
      failure("VALIDATION_FAILED", "Please choose a valid number of variants.")
    )
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("rejects additionalCount 4 without calling auth", async () => {
    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 4,
    })

    expect(result).toEqual(
      failure("VALIDATION_FAILED", "Please choose a valid number of variants.")
    )
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 1,
    })

    expect(result).toEqual(
      failure("NOT_AUTHENTICATED", "You must be logged in to generate a worksheet.")
    )
  })

  it("returns profile not found when profile is missing", async () => {
    mockProfilesSingle.mockResolvedValue({ data: null, error: null })

    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 1,
    })

    expect(result).toEqual(failure("PROFILE_NOT_FOUND"))
  })

  it("returns worksheet not found when worksheet is missing", async () => {
    mockWorksheetsSingle.mockResolvedValue({ data: null, error: { message: "missing" } })

    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 1,
    })

    expect(result).toEqual(failure("WORKSHEET_ACCESS_DENIED", "Worksheet not found."))
  })

  it("rejects when all variant slots are used", async () => {
    mockWorksheetVariants({
      saved: [
        makeSaveableVariant({ id: "22222222-2222-4222-8222-222222222222", label: "B" }),
        makeSaveableVariant({ id: "33333333-3333-4333-8333-333333333333", label: "C" }),
        makeSaveableVariant({ id: "44444444-4444-4444-8444-444444444444", label: "D" }),
      ],
    })

    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 1,
    })

    expect(result).toEqual(
      failure("VALIDATION_FAILED", "Please choose a valid number of variants.")
    )
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("returns worksheet incomplete message when enqueue reports not fully generated", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "worksheet is not fully generated yet" },
    })

    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 1,
    })

    expect(result).toEqual(
      failure(
        "UNKNOWN",
        "The worksheet must be fully generated before creating variants."
      )
    )
  })

  it("returns already active message when enqueue reports active job", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "generation job already active" },
    })

    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 1,
    })

    expect(result).toEqual(
      failure("UNKNOWN", "A generation job is already running for this worksheet.")
    )
  })

  it("returns generic enqueue failure message", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    })

    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 1,
    })

    expect(result).toEqual(failure("UNKNOWN", "Could not start variant generation."))
  })

  it("returns unknown when enqueue response is not a string job id", async () => {
    mockRpc.mockResolvedValue({ data: { jobId }, error: null })

    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 1,
    })

    expect(result).toEqual(failure("UNKNOWN", "Could not start variant generation."))
  })

  it("returns unknown when inngest is not configured and marks job failed", async () => {
    vi.stubEnv("INNGEST_EVENT_KEY", "")

    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 1,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain("INNGEST_EVENT_KEY")
    }
    expect(mockAdminJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" })
    )
    expect(mockAdminJobUpdateEq).toHaveBeenCalledWith("id", jobId)
    expect(mockAdminJobUpdateEq).toHaveBeenCalledWith("user_id", profileId)
  })

  it("marks job failed when inngest send throws", async () => {
    mockInngestSend.mockRejectedValue(new Error("network down"))

    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 1,
    })

    expect(result).toEqual(failure("UNKNOWN", "network down"))
    expect(mockAdminJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error_message: "network down" })
    )
    expect(mockAdminJobUpdateEq).toHaveBeenCalledWith("id", jobId)
    expect(mockAdminJobUpdateEq).toHaveBeenCalledWith("user_id", profileId)
  })

  it("starts job, sends inngest event, and revalidates on success", async () => {
    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 1,
    })

    expect(result).toEqual({
      ok: true,
      data: { jobId, worksheetId, labels: ["B"] },
    })
    expect(mockRpc).toHaveBeenCalledWith("enqueue_variant_generation_job", {
      p_worksheet_id: worksheetId,
      p_variant_labels: ["B"],
    })
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: "worksheet/generation.requested",
      data: { jobId, worksheetId, profileId },
    })
    expect(revalidatePath).toHaveBeenCalledWith("/generate")
    expect(revalidatePath).toHaveBeenCalledWith(`/library/${worksheetId}`)
  })

  it("allocates remaining labels when some variants are already saved", async () => {
    mockWorksheetVariants({
      saved: [makeSaveableVariant({ label: "B" })],
    })

    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 2,
    })

    expect(result).toEqual({
      ok: true,
      data: { jobId, worksheetId, labels: ["C", "D"] },
    })
    expect(mockRpc).toHaveBeenCalledWith("enqueue_variant_generation_job", {
      p_worksheet_id: worksheetId,
      p_variant_labels: ["C", "D"],
    })
  })

  it("rejects invalid worksheet id after variants are loaded", async () => {
    mockWorksheetVariants({ saved: [] })

    const result = await startVariantGenerationJobAction({
      worksheetId: "not-a-uuid",
      additionalCount: 1,
    })

    expect(result).toEqual(failure("VALIDATION_FAILED", "Invalid worksheet."))
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("runs inline worker when E2E_STUB_GENERATION is enabled", async () => {
    vi.stubEnv("E2E_STUB_GENERATION", "true")
    vi.stubEnv("INNGEST_EVENT_KEY", "")

    const result = await startVariantGenerationJobAction({
      worksheetId,
      additionalCount: 1,
    })

    expect(result.ok).toBe(true)
    expect(mockRunGenerationJobWorker).toHaveBeenCalledWith({
      jobId,
      worksheetId,
      profileId,
    })
    expect(mockInngestSend).not.toHaveBeenCalled()
  })
})

describe("getVariantGenerationJobAction", () => {
  const variantJob = makeVariantJobRow()

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticatedWithProfile(12)
    mockWorksheetQuestions([validWorksheetQuestion])
    mockGenerationJobSingle.mockResolvedValue({ data: variantJob, error: null })
    mockWorksheetsSingle.mockResolvedValue({
      data: { id: worksheetId, question_count: 2 },
      error: null,
    })
  })

  it("rejects invalid job id", async () => {
    const result = await getVariantGenerationJobAction("not-a-uuid")

    expect(result).toEqual(failure("VALIDATION_FAILED", "Invalid generation job."))
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await getVariantGenerationJobAction(jobId)

    expect(result).toEqual(
      failure("NOT_AUTHENTICATED", "You must be logged in to view generation progress.")
    )
  })

  it("returns not found when job row is missing", async () => {
    mockGenerationJobSingle.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    })

    const result = await getVariantGenerationJobAction(jobId)

    expect(result).toEqual(failure("UNKNOWN", "Generation job not found."))
  })

  it("returns not found when job kind is not variant", async () => {
    mockGenerationJobSingle.mockResolvedValue({
      data: { ...variantJob, kind: "initial" },
      error: null,
    })

    const result = await getVariantGenerationJobAction(jobId)

    expect(result).toEqual(failure("UNKNOWN", "Generation job not found."))
  })

  it("returns unknown when job status is invalid", async () => {
    mockGenerationJobSingle.mockResolvedValue({
      data: { ...variantJob, status: "bogus" },
      error: null,
    })

    const result = await getVariantGenerationJobAction(jobId)

    expect(result).toEqual(
      failure("UNKNOWN", "Generation job is in an invalid state.")
    )
  })

  it("returns worksheet access denied when worksheet is missing", async () => {
    mockWorksheetsSingle.mockResolvedValue({ data: null, error: { message: "missing" } })

    const result = await getVariantGenerationJobAction(jobId)

    expect(result).toEqual(failure("WORKSHEET_ACCESS_DENIED", "Worksheet not found."))
  })

  it("does not fetch worksheet questions on a poll tick", async () => {
    // Variant polls derive everything from the job row; the master questions
    // are already on the client, so the per-tick fetch was pure waste.
    const result = await getVariantGenerationJobAction(jobId)

    expect(result.ok).toBe(true)
    expect(mockWorksheetQuestionsOrder).not.toHaveBeenCalled()
  })

  it("returns null credit balance when profile is missing", async () => {
    mockProfilesSingle.mockResolvedValue({ data: null, error: null })

    const result = await getVariantGenerationJobAction(jobId)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.creditBalance).toBeNull()
    }
  })

  it("returns mapped poll with variant progress on success", async () => {
    const result = await getVariantGenerationJobAction(jobId)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.jobId).toBe(jobId)
      expect(result.data.status).toBe("running")
      expect(result.data.variantProgress).toEqual({ current: 1, total: 4 })
      expect(result.data.creditBalance).toBe(12)
      expect(result.data.statusMessage).toContain("variants")
    }
  })
})

describe("saveWorksheetVariantsAction", () => {
  const saveableVariant = makeSaveableVariant()

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticatedWithProfile()
    mockEnqueueVariantJob()
  })

  it("rejects invalid worksheet id", async () => {
    const result = await saveWorksheetVariantsAction({
      worksheetId: "not-a-uuid",
      variants: [saveableVariant],
    })

    expect(result).toEqual(failure("VALIDATION_FAILED", "Invalid variant data."))
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("rejects empty variants array", async () => {
    const result = await saveWorksheetVariantsAction({
      worksheetId,
      variants: [],
    })

    expect(result).toEqual(failure("VALIDATION_FAILED", "Invalid variant data."))
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("rejects variants missing required roll fields", async () => {
    const result = await saveWorksheetVariantsAction({
      worksheetId,
      variants: [
        {
          ...saveableVariant,
          rolls: [{ order: 1, given_values: [], solution: { steps: [], final_answer: "" } }],
        },
      ],
    })

    expect(result).toEqual(failure("VALIDATION_FAILED", "Invalid variant data."))
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("rejects variants that exceed worksheet roll limits after input validation", async () => {
    const tooManyRolls = Array.from({ length: 41 }, () => ({
      order: 1,
      given_values: validWorksheetQuestion.given_values,
      solution: validWorksheetQuestion.solution,
    }))

    const result = await saveWorksheetVariantsAction({
      worksheetId,
      variants: [{ ...saveableVariant, rolls: tooManyRolls }],
    })

    expect(result).toEqual(failure("VALIDATION_FAILED", "Invalid variant data."))
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await saveWorksheetVariantsAction({
      worksheetId,
      variants: [saveableVariant],
    })

    expect(result).toEqual(failure("NOT_AUTHENTICATED"))
  })

  it("propagates structured rpc failures", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        code: "WORKSHEET_ACCESS_DENIED",
        message: "You do not have access to this worksheet.",
      },
      error: null,
    })

    const result = await saveWorksheetVariantsAction({
      worksheetId,
      variants: [saveableVariant],
    })

    expect(result).toEqual(
      failure("WORKSHEET_ACCESS_DENIED", "You do not have access to this worksheet.")
    )
  })

  it("returns unknown when rpc returns error only", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "db error" },
    })

    const result = await saveWorksheetVariantsAction({
      worksheetId,
      variants: [saveableVariant],
    })

    expect(result).toEqual(failure("UNKNOWN", "Could not save variants."))
  })

  it("saves variants and revalidates on success", async () => {
    const result = await saveWorksheetVariantsAction({
      worksheetId,
      variants: [saveableVariant],
    })

    expect(result).toEqual({ ok: true, data: null })
    expect(mockRpc).toHaveBeenCalledWith("save_worksheet_variants", {
      p_worksheet_id: worksheetId,
      p_variants: { saved: [saveableVariant] },
    })
    expect(revalidatePath).toHaveBeenCalledWith("/library")
    expect(revalidatePath).toHaveBeenCalledWith(`/library/${worksheetId}`)
    expect(revalidatePath).toHaveBeenCalledWith("/generate")
  })
})

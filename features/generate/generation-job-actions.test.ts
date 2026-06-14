import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

const mockGetUser = vi.fn()
const mockRpc = vi.fn()
const mockWorksheetsSingle = vi.fn()
const mockWorksheetQuestionsOrder = vi.fn()
const mockProfilesSingle = vi.fn()
const mockGenerationJobSingle = vi.fn()
const mockGenerationJobsLimit = vi.fn()
const mockInngestSend = vi.fn()
const mockAdminRpc = vi.fn()

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
            eq: vi.fn((column: string) => {
              if (column === "id") {
                return {
                  single: mockGenerationJobSingle,
                }
              }

              return {
                in: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: mockGenerationJobsLimit,
                  })),
                })),
              }
            }),
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
  })),
}))

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: (...args: unknown[]) => mockInngestSend(...args),
  },
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import {
  getActiveGenerationJobForWorksheetAction,
  getGenerationJobAction,
  startAppendGenerationJobAction,
  startWorksheetGenerationJobAction,
} from "./generation-job-actions"
import { failure } from "./errors"
import { revalidatePath } from "next/cache"

const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
const jobId = "b1b2c3d4-e5f6-4789-a012-3456789abcde"
const profileId = "11111111-1111-4111-8111-111111111111"
const authUserId = "user-auth-1"

const generateInput = {
  subject: "physics" as const,
  lesson: "Linear equations",
  scenario: "Solve for x.",
  question_count: 3,
}

function initRpcSuccess(id: string = worksheetId) {
  return { data: { success: true, worksheetId: id }, error: null }
}

function enqueueRpcSuccess(id: string = jobId) {
  return { data: { success: true, jobId: id }, error: null }
}

function extendRpcSuccess(questionCount: number) {
  return { data: { success: true, questionCount }, error: null }
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

function mockStartJobRpcs() {
  mockRpc.mockImplementation(async (name: string) => {
    if (name === "generate_worksheet_init") {
      return initRpcSuccess()
    }
    if (name === "enqueue_generation_job") {
      return enqueueRpcSuccess()
    }
    if (name === "extend_worksheet_count") {
      return extendRpcSuccess(5)
    }
    throw new Error(`Unexpected rpc: ${name}`)
  })
}

describe("startWorksheetGenerationJobAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("INNGEST_EVENT_KEY", "test-key")
    mockInngestSend.mockResolvedValue(undefined)
    mockAdminRpc.mockResolvedValue({ data: null, error: null })
    mockAuthenticatedWithProfile()
    mockStartJobRpcs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejects invalid input without calling auth", async () => {
    const result = await startWorksheetGenerationJobAction({
      ...generateInput,
      question_count: 0,
    })

    expect(result).toEqual(
      failure("VALIDATION_FAILED", "Please complete the worksheet settings.")
    )
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await startWorksheetGenerationJobAction(generateInput)

    expect(result).toEqual(
      failure("NOT_AUTHENTICATED", "You must be logged in to generate a worksheet.")
    )
  })

  it("returns profile not found when profile is missing", async () => {
    mockProfilesSingle.mockResolvedValue({ data: null, error: null })

    const result = await startWorksheetGenerationJobAction(generateInput)

    expect(result).toEqual(failure("PROFILE_NOT_FOUND"))
  })

  it("propagates structured init rpc failures", async () => {
    mockRpc.mockImplementation(async (name: string) => {
      if (name === "generate_worksheet_init") {
        return {
          data: {
            success: false,
            code: "INSUFFICIENT_CREDITS",
            message: "Not enough credits.",
          },
          error: null,
        }
      }
      return enqueueRpcSuccess()
    })

    const result = await startWorksheetGenerationJobAction(generateInput)

    expect(result).toEqual(failure("INSUFFICIENT_CREDITS", "Not enough credits."))
  })

  it("returns unknown when init response lacks worksheetId", async () => {
    mockRpc.mockImplementation(async (name: string) => {
      if (name === "generate_worksheet_init") {
        return { data: { success: true }, error: null }
      }
      return enqueueRpcSuccess()
    })

    const result = await startWorksheetGenerationJobAction(generateInput)

    expect(result).toEqual(failure("UNKNOWN", "Could not start worksheet generation."))
  })

  it("returns unknown when enqueue response lacks jobId", async () => {
    mockRpc.mockImplementation(async (name: string) => {
      if (name === "generate_worksheet_init") {
        return initRpcSuccess()
      }
      return { data: { success: true }, error: null }
    })

    const result = await startWorksheetGenerationJobAction(generateInput)

    expect(result).toEqual(failure("UNKNOWN", "Could not start the generation job."))
  })

  it("returns unknown when enqueue rpc fails", async () => {
    mockRpc.mockImplementation(async (name: string) => {
      if (name === "generate_worksheet_init") {
        return initRpcSuccess()
      }
      return { data: null, error: { message: "enqueue failed" } }
    })

    const result = await startWorksheetGenerationJobAction(generateInput)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe("Could not start the generation job.")
    }
  })

  it("starts job, sends inngest event, and revalidates on success", async () => {
    const result = await startWorksheetGenerationJobAction(generateInput)

    expect(result).toEqual({ ok: true, data: { jobId, worksheetId } })
    expect(mockRpc).toHaveBeenCalledWith(
      "generate_worksheet_init",
      expect.objectContaining({
        p_question_count: 3,
        p_subject: "physics",
      })
    )
    expect(mockRpc).toHaveBeenCalledWith(
      "enqueue_generation_job",
      expect.objectContaining({
        p_worksheet_id: worksheetId,
        p_from_order: 1,
        p_to_order: 3,
        p_kind: "initial",
      })
    )
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: "worksheet/generation.requested",
      data: { jobId, worksheetId, profileId },
    })
    expect(revalidatePath).toHaveBeenCalledWith("/generate")
  })

  it("returns unknown when inngest is not configured", async () => {
    vi.stubEnv("INNGEST_EVENT_KEY", "")

    const result = await startWorksheetGenerationJobAction(generateInput)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain("INNGEST_EVENT_KEY")
    }
    expect(mockAdminRpc).toHaveBeenCalledWith(
      "update_generation_job_progress",
      expect.objectContaining({
        p_job_id: jobId,
        p_status: "failed",
      })
    )
  })

  it("marks job failed when inngest send throws", async () => {
    mockInngestSend.mockRejectedValue(new Error("network down"))

    const result = await startWorksheetGenerationJobAction(generateInput)

    expect(result).toEqual(failure("UNKNOWN", "network down"))
    expect(mockAdminRpc).toHaveBeenCalledWith(
      "update_generation_job_progress",
      expect.objectContaining({
        p_job_id: jobId,
        p_status: "failed",
        p_error_message: "network down",
      })
    )
  })
})

describe("startAppendGenerationJobAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("INNGEST_EVENT_KEY", "test-key")
    mockInngestSend.mockResolvedValue(undefined)
    mockAdminRpc.mockResolvedValue({ data: null, error: null })
    mockAuthenticatedWithProfile()
    mockStartJobRpcs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejects invalid worksheet id", async () => {
    const result = await startAppendGenerationJobAction({
      worksheetId: "not-a-uuid",
      additionalCount: 2,
    })

    expect(result).toEqual(
      failure("VALIDATION_FAILED", "Please choose a valid number of questions to append.")
    )
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("rejects additionalCount out of range", async () => {
    const result = await startAppendGenerationJobAction({
      worksheetId,
      additionalCount: 21,
    })

    expect(result).toEqual(
      failure("VALIDATION_FAILED", "Please choose a valid number of questions to append.")
    )
  })

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await startAppendGenerationJobAction({
      worksheetId,
      additionalCount: 2,
    })

    expect(result).toEqual(
      failure("NOT_AUTHENTICATED", "You must be logged in to append questions.")
    )
  })

  it("returns unknown when extend response lacks questionCount", async () => {
    mockRpc.mockImplementation(async (name: string) => {
      if (name === "extend_worksheet_count") {
        return { data: { success: true }, error: null }
      }
      return enqueueRpcSuccess()
    })

    const result = await startAppendGenerationJobAction({
      worksheetId,
      additionalCount: 2,
    })

    expect(result).toEqual(
      failure("UNKNOWN", "Could not extend the worksheet question count.")
    )
  })

  it("extends, enqueues append job, and sends inngest event", async () => {
    const result = await startAppendGenerationJobAction({
      worksheetId,
      additionalCount: 2,
    })

    expect(result).toEqual({
      ok: true,
      data: { jobId, worksheetId, newQuestionCount: 5 },
    })
    expect(mockRpc).toHaveBeenCalledWith("extend_worksheet_count", {
      p_worksheet_id: worksheetId,
      p_additional_count: 2,
    })
    expect(mockRpc).toHaveBeenCalledWith(
      "enqueue_generation_job",
      expect.objectContaining({
        p_worksheet_id: worksheetId,
        p_from_order: 4,
        p_to_order: 5,
        p_kind: "append",
      })
    )
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: "worksheet/generation.requested",
      data: { jobId, worksheetId, profileId },
    })
    expect(revalidatePath).toHaveBeenCalledWith("/generate")
  })

  it("marks job failed when inngest send throws", async () => {
    mockInngestSend.mockRejectedValue(new Error("send failed"))

    const result = await startAppendGenerationJobAction({
      worksheetId,
      additionalCount: 1,
    })

    expect(result).toEqual(failure("UNKNOWN", "send failed"))
    expect(mockAdminRpc).toHaveBeenCalledWith(
      "update_generation_job_progress",
      expect.objectContaining({
        p_job_id: jobId,
        p_status: "failed",
      })
    )
  })
})

describe("getGenerationJobAction", () => {
  const completedJob = {
    id: jobId,
    user_id: profileId,
    worksheet_id: worksheetId,
    kind: "initial" as const,
    status: "completed" as const,
    from_order: 1,
    to_order: 2,
    last_completed_order: 2,
    skipped_orders: [],
    error_message: null,
    inngest_run_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticatedWithProfile(12)
    mockWorksheetQuestions([validWorksheetQuestion])
    mockGenerationJobSingle.mockResolvedValue({ data: completedJob, error: null })
    mockWorksheetsSingle.mockResolvedValue({
      data: { id: worksheetId, question_count: 2 },
      error: null,
    })
  })

  it("rejects invalid job id", async () => {
    const result = await getGenerationJobAction("not-a-uuid")

    expect(result).toEqual(failure("VALIDATION_FAILED", "Invalid generation job."))
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await getGenerationJobAction(jobId)

    expect(result).toEqual(
      failure("NOT_AUTHENTICATED", "You must be logged in to view generation progress.")
    )
  })

  it("returns not found when job row is missing", async () => {
    mockGenerationJobSingle.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    })

    const result = await getGenerationJobAction(jobId)

    expect(result).toEqual(failure("UNKNOWN", "Generation job not found."))
  })

  it("returns unknown when job status is invalid", async () => {
    mockGenerationJobSingle.mockResolvedValue({
      data: { ...completedJob, status: "bogus" },
      error: null,
    })

    const result = await getGenerationJobAction(jobId)

    expect(result).toEqual(failure("UNKNOWN", "Generation job is in an invalid state."))
  })

  it("returns worksheet access denied when worksheet is missing", async () => {
    mockWorksheetsSingle.mockResolvedValue({ data: null, error: { message: "missing" } })

    const result = await getGenerationJobAction(jobId)

    expect(result).toEqual(failure("WORKSHEET_ACCESS_DENIED", "Worksheet not found."))
  })

  it("returns questions load failed when questions cannot be fetched", async () => {
    mockWorksheetQuestionsOrder.mockResolvedValue({
      data: null,
      error: { message: "db error" },
    })

    const result = await getGenerationJobAction(jobId)

    expect(result).toEqual(failure("QUESTIONS_LOAD_FAILED"))
  })

  it("returns mapped poll on success", async () => {
    const result = await getGenerationJobAction(jobId)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.jobId).toBe(jobId)
      expect(result.data.status).toBe("completed")
      expect(result.data.isTerminal).toBe(true)
      expect(result.data.creditBalance).toBe(12)
      expect(result.data.statusMessage).toBe("Worksheet complete.")
    }
  })

  it("returns null credit balance when profile is missing", async () => {
    mockProfilesSingle.mockResolvedValue({ data: null, error: null })

    const result = await getGenerationJobAction(jobId)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.creditBalance).toBeNull()
    }
  })
})

describe("getActiveGenerationJobForWorksheetAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: authUserId } } })
    mockGenerationJobsLimit.mockResolvedValue({ data: [], error: null })
  })

  it("rejects invalid worksheet id", async () => {
    const result = await getActiveGenerationJobForWorksheetAction("bad-id")

    expect(result).toEqual(failure("VALIDATION_FAILED", "Invalid worksheet."))
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await getActiveGenerationJobForWorksheetAction(worksheetId)

    expect(result).toEqual(failure("NOT_AUTHENTICATED", "You must be logged in."))
  })

  it("returns unknown when query fails", async () => {
    mockGenerationJobsLimit.mockResolvedValue({
      data: null,
      error: { message: "db error" },
    })

    const result = await getActiveGenerationJobForWorksheetAction(worksheetId)

    expect(result).toEqual(failure("UNKNOWN", "Could not load generation job."))
  })

  it("returns null when no active job exists", async () => {
    const result = await getActiveGenerationJobForWorksheetAction(worksheetId)

    expect(result).toEqual({ ok: true, data: null })
  })

  it("returns active job id when one exists", async () => {
    mockGenerationJobsLimit.mockResolvedValue({
      data: [{ id: jobId }],
      error: null,
    })

    const result = await getActiveGenerationJobForWorksheetAction(worksheetId)

    expect(result).toEqual({ ok: true, data: { jobId } })
  })
})

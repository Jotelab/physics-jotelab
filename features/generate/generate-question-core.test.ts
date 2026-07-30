import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  appendRpcResponse,
  completeFailureRpcResponse,
  pendingQuestionId,
  reservationId,
  reserveAlreadyCompletedResponse,
  reserveRpcResponse,
  validGeneratedQuestion,
  validWorksheetQuestion,
} from "@/tests/fixtures/worksheet-question"

const mockRpc = vi.fn()
const mockWorksheetsSingle = vi.fn()
const mockWorksheetQuestionsOrder = vi.fn()
const mockProfilesSingle = vi.fn()
const mockGenerateWorksheetQuestion = vi.fn()
const mockRegenerateWorksheetQuestion = vi.fn()
const mockGenerateEngineQuestion = vi.fn()

vi.mock("@/lib/ai/generate-question", () => ({
  generateWorksheetQuestion: (...args: unknown[]) => mockGenerateWorksheetQuestion(...args),
}))

vi.mock("@/lib/ai/regenerate-question", () => ({
  regenerateWorksheetQuestion: (...args: unknown[]) => mockRegenerateWorksheetQuestion(...args),
}))

vi.mock("@/lib/ai/generate-engine-question", () => ({
  generateEngineQuestion: (...args: unknown[]) => mockGenerateEngineQuestion(...args),
  sympyDataGivenNames: (sympyData: { given: { symbol: string }[] }) =>
    sympyData.given.map((given) => given.symbol),
}))

function createSupabaseClient() {
  return {
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

      throw new Error(`Unexpected table: ${table}`)
    }),
    rpc: mockRpc,
  }
}

import { EngineError } from "@/lib/engine/client"

import { generateQuestionForWorksheet, regenerateQuestionForWorksheet } from "./generate-question-core"
import { failure } from "./errors"
import { buildGenerateIdempotencyKey, buildRegenerateIdempotencyKey } from "./utils/idempotency-key"

const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
const profileId = "11111111-1111-4111-8111-111111111111"
const otherProfileId = "22222222-2222-4222-8222-222222222222"
const questionId = validWorksheetQuestion.id
const attemptId = "99999999-9999-4999-8999-999999999999"
const generateIdempotencyKey = buildGenerateIdempotencyKey(worksheetId, 1)
const regenerateIdempotencyKey = buildRegenerateIdempotencyKey(worksheetId, questionId, attemptId)

function makeWorksheetRow(
  overrides: Partial<{
    id: string
    user_id: string
    subject: "physics"
    question_count: number
    generation_settings: unknown
  }> = {}
) {
  return {
    id: worksheetId,
    user_id: profileId,
    subject: "physics" as const,
    question_count: 5,
    generation_settings: { lesson: "Motion", scenario: "Find velocity." },
    ...overrides,
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

function mockGenerateReservationFlow({
  reserveCreditBalance = 41,
  completeCreditBalance = 41,
  reserveError = null as { message: string } | null,
  completeError = null as { message: string } | null,
} = {}) {
  mockRpc.mockImplementation((name: string) => {
    switch (name) {
      case "reserve_generate_question_credit":
        return Promise.resolve({
          data: reserveError ? null : reserveRpcResponse(reserveCreditBalance),
          error: reserveError,
        })
      case "complete_generate_question_reservation":
        return Promise.resolve({
          data: completeError ? null : appendRpcResponse({ creditBalance: completeCreditBalance }),
          error: completeError,
        })
      case "cancel_generate_question_reservation":
        return Promise.resolve({ data: { creditBalance: 42 }, error: null })
      default:
        return Promise.resolve({ data: null, error: { message: `Unexpected rpc: ${name}` } })
    }
  })
}

function mockRegenerateReservationFlow({
  reserveCreditBalance = 4,
  completeCreditBalance = 4,
  reserveError = null as { message: string } | null,
  completeError = null as { message: string } | null,
} = {}) {
  mockRpc.mockImplementation((name: string) => {
    switch (name) {
      case "reserve_regenerate_question_credit":
        return Promise.resolve({
          data: reserveError ? null : reserveRpcResponse(reserveCreditBalance),
          error: reserveError,
        })
      case "complete_regenerate_question_reservation":
        return Promise.resolve({
          data: completeError ? null : appendRpcResponse({ creditBalance: completeCreditBalance }),
          error: completeError,
        })
      case "cancel_regenerate_question_reservation":
        return Promise.resolve({ data: { creditBalance: 5 }, error: null })
      default:
        return Promise.resolve({ data: null, error: { message: `Unexpected rpc: ${name}` } })
    }
  })
}

describe("generateQuestionForWorksheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow(),
      error: null,
    })
    mockWorksheetQuestions()
    mockProfilesSingle.mockResolvedValue({
      data: { credit_balance: 42 },
      error: null,
    })
    mockGenerateWorksheetQuestion.mockResolvedValue(validGeneratedQuestion)
  })

  it("returns an existing question without calling AI when the slot is filled", async () => {
    mockWorksheetQuestions([validWorksheetQuestion])

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result).toEqual({
      ok: true,
      data: { question: validWorksheetQuestion, creditBalance: 42 },
    })
    expect(mockGenerateWorksheetQuestion).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("generates and saves a new question", async () => {
    mockGenerateReservationFlow()

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.creditBalance).toBe(41)
      expect(result.data.question.order).toBe(1)
      expect(result.data.question.question_text).toBe(validGeneratedQuestion.question_text)
    }
    expect(mockGenerateWorksheetQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "physics",
        lesson: "Motion",
      })
    )
    expect(mockRpc).toHaveBeenNthCalledWith(
      1,
      "reserve_generate_question_credit",
      expect.objectContaining({
        p_worksheet_id: worksheetId,
        p_order: 1,
        p_idempotency_key: generateIdempotencyKey,
      })
    )
    expect(mockRpc).toHaveBeenNthCalledWith(
      2,
      "complete_generate_question_reservation",
      expect.objectContaining({
        p_reservation_id: reservationId,
        p_idempotency_key: generateIdempotencyKey,
        p_question: expect.objectContaining({ id: pendingQuestionId }),
      })
    )
  })

  it("routes engine-backed lessons (motion-1d) through the neuro-symbolic path", async () => {
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow({
        generation_settings: { lesson: "motion-1d", scenario: "Find velocity." },
      }),
      error: null,
    })
    mockGenerateEngineQuestion.mockResolvedValue(validGeneratedQuestion)
    mockGenerateReservationFlow()

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result.ok).toBe(true)
    expect(mockGenerateEngineQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "physics", lesson: "motion-1d" })
    )
    expect(mockGenerateWorksheetQuestion).not.toHaveBeenCalled()
  })

  it("returns ENGINE_UNAVAILABLE and cancels the reservation when the engine is unreachable", async () => {
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow({
        generation_settings: { lesson: "motion-1d", scenario: "Find velocity." },
      }),
      error: null,
    })
    mockGenerateEngineQuestion.mockRejectedValue(
      new EngineError("Could not reach the symbolic engine: fetch failed")
    )
    mockGenerateReservationFlow()

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      // The dedicated code lets the client localize the outage and promise the
      // refund; the raw fetch error must never surface.
      expect(result.code).toBe("ENGINE_UNAVAILABLE")
      expect(result.message).not.toContain("fetch failed")
    }
    expect(mockRpc).toHaveBeenNthCalledWith(
      2,
      "cancel_generate_question_reservation",
      expect.objectContaining({
        p_reservation_id: reservationId,
        p_idempotency_key: generateIdempotencyKey,
      })
    )
  })

  it("passes advanced-mode pins to the engine as mapped given/find constraints", async () => {
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow({
        generation_settings: {
          lesson: "motion-1d",
          scenario: "Find displacement.",
          given_variables: [{ symbol: "v₀", label: "ความเร็วต้น", value: 0 }],
          target_variables: [{ symbol: "s", label: "การกระจัด", unit: "m" }],
        },
      }),
      error: null,
    })
    mockGenerateEngineQuestion.mockResolvedValue(validGeneratedQuestion)
    mockGenerateReservationFlow()

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result.ok).toBe(true)
    expect(mockGenerateEngineQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        // Display symbols mapped to engine names: v₀ → u, s → s.
        given: ["u"],
        find: "s",
        completeSplit: true,
      })
    )
  })

  it("drops engine pins whose display symbol the topic does not know", async () => {
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow({
        generation_settings: {
          lesson: "motion-1d",
          scenario: "Find force.",
          // Force is not a SUVAT variable — the pin must be dropped, not sent.
          target_variables: [{ symbol: "F", label: "แรง", unit: "N" }],
        },
      }),
      error: null,
    })
    mockGenerateEngineQuestion.mockResolvedValue(validGeneratedQuestion)
    mockGenerateReservationFlow()

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result.ok).toBe(true)
    const call = mockGenerateEngineQuestion.mock.calls[0]?.[0] as Record<string, unknown>
    expect(call.find).toBeUndefined()
    expect(call.given).toBeUndefined()
  })

  it("skips AI when reserve reports the slot already completed", async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === "reserve_generate_question_credit") {
        return Promise.resolve({ data: reserveAlreadyCompletedResponse(41), error: null })
      }
      return Promise.resolve({ data: null, error: { message: `Unexpected rpc: ${name}` } })
    })

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.question).toEqual(validWorksheetQuestion)
      expect(result.data.creditBalance).toBe(41)
    }
    expect(mockGenerateWorksheetQuestion).not.toHaveBeenCalled()
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it("rejects orders beyond the worksheet question count", async () => {
    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 6,
      previousQuestionsContext: [],
    })

    expect(result).toEqual(failure("WORKSHEET_ALREADY_COMPLETE"))
    expect(mockGenerateWorksheetQuestion).not.toHaveBeenCalled()
  })

  it("rejects when the worksheet belongs to another profile", async () => {
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow({ user_id: otherProfileId }),
      error: null,
    })

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result).toEqual(failure("WORKSHEET_ACCESS_DENIED"))
    expect(mockGenerateWorksheetQuestion).not.toHaveBeenCalled()
  })

  it("does not call AI when credit reservation fails", async () => {
    mockGenerateReservationFlow({
      reserveError: { message: "Insufficient credits" },
    })

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result).toEqual(failure("INSUFFICIENT_CREDITS"))
    expect(mockGenerateWorksheetQuestion).not.toHaveBeenCalled()
  })

  it("returns load failed when questions cannot be fetched", async () => {
    mockWorksheetQuestionsOrder.mockResolvedValue({
      data: null,
      error: { message: "connection failed" },
    })

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result).toEqual(failure("QUESTIONS_LOAD_FAILED"))
    expect(mockGenerateWorksheetQuestion).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects missing generation settings", async () => {
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow({ generation_settings: {} }),
      error: null,
    })

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result).toEqual(failure("GENERATION_SETTINGS_MISSING"))
  })

  it("returns credit balance unavailable for a filled slot when profile balance cannot load", async () => {
    mockWorksheetQuestions([validWorksheetQuestion])
    mockProfilesSingle.mockResolvedValue({ data: null, error: null })

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result).toEqual(failure("CREDIT_BALANCE_UNAVAILABLE"))
  })

  it("returns AI errors and cancels the reservation", async () => {
    mockGenerateReservationFlow()
    mockGenerateWorksheetQuestion.mockRejectedValue(new Error("model timeout"))

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe("model timeout")
    }
    expect(mockRpc).toHaveBeenNthCalledWith(
      2,
      "cancel_generate_question_reservation",
      expect.objectContaining({
        p_reservation_id: reservationId,
        p_idempotency_key: generateIdempotencyKey,
      })
    )
  })

  it("cancels the reservation when complete rpc fails after AI succeeds", async () => {
    mockGenerateReservationFlow({
      completeError: { message: "complete failed" },
    })

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result).toEqual(failure("SAVE_FAILED"))
    expect(mockRpc).toHaveBeenNthCalledWith(
      3,
      "cancel_generate_question_reservation",
      expect.objectContaining({ p_reservation_id: reservationId })
    )
  })

  it("does not cancel when complete returns a DB-side refund failure", async () => {
    mockRpc.mockImplementation((name: string) => {
      switch (name) {
        case "reserve_generate_question_credit":
          return Promise.resolve({ data: reserveRpcResponse(41), error: null })
        case "complete_generate_question_reservation":
          return Promise.resolve({ data: completeFailureRpcResponse(), error: null })
        default:
          return Promise.resolve({ data: null, error: null })
      }
    })

    const supabase = createSupabaseClient()

    const result = await generateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      order: 1,
      previousQuestionsContext: [],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe("WORKSHEET_ALREADY_COMPLETE")
      expect(result.creditBalance).toBe(42)
    }
    expect(mockRpc).toHaveBeenCalledTimes(2)
    expect(mockRpc).not.toHaveBeenCalledWith(
      "cancel_generate_question_reservation",
      expect.any(Object)
    )
  })
})

describe("regenerateQuestionForWorksheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow(),
      error: null,
    })
    mockWorksheetQuestions([validWorksheetQuestion])
    mockRegenerateWorksheetQuestion.mockResolvedValue(validGeneratedQuestion)
    mockRegenerateReservationFlow()
  })

  it("regenerates a question and returns the new credit balance", async () => {
    const supabase = createSupabaseClient()

    const result = await regenerateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      questionId,
      attemptId,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.creditBalance).toBe(4)
      expect(result.data.question.id).toBe(questionId)
      expect(result.data.question.order).toBe(1)
    }
    expect(mockRegenerateWorksheetQuestion).toHaveBeenCalled()
    expect(mockRpc).toHaveBeenNthCalledWith(
      1,
      "reserve_regenerate_question_credit",
      expect.objectContaining({
        p_worksheet_id: worksheetId,
        p_question_id: questionId,
        p_idempotency_key: regenerateIdempotencyKey,
      })
    )
    expect(mockRpc).toHaveBeenNthCalledWith(
      2,
      "complete_regenerate_question_reservation",
      expect.objectContaining({
        p_reservation_id: reservationId,
        p_idempotency_key: regenerateIdempotencyKey,
      })
    )
  })

  it("rejects regeneration when the worksheet belongs to another profile", async () => {
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow({ user_id: otherProfileId }),
      error: null,
    })

    const supabase = createSupabaseClient()

    const result = await regenerateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      questionId,
      attemptId,
    })

    expect(result).toEqual(failure("WORKSHEET_ACCESS_DENIED"))
    expect(mockRegenerateWorksheetQuestion).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects regeneration when credits are insufficient", async () => {
    mockRegenerateReservationFlow({
      reserveError: { message: "Insufficient credits" },
    })

    const supabase = createSupabaseClient()

    const result = await regenerateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      questionId,
      attemptId,
    })

    expect(result).toEqual(failure("INSUFFICIENT_CREDITS"))
    expect(mockRegenerateWorksheetQuestion).not.toHaveBeenCalled()
  })

  it("returns not found when the question does not exist", async () => {
    const supabase = createSupabaseClient()

    const result = await regenerateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      questionId: "00000000-0000-4000-8000-000000000099",
      attemptId,
    })

    expect(result).toEqual(failure("QUESTION_NOT_FOUND"))
    expect(mockRegenerateWorksheetQuestion).not.toHaveBeenCalled()
  })

  it("returns load failed when questions cannot be fetched", async () => {
    mockWorksheetQuestionsOrder.mockResolvedValue({
      data: null,
      error: { message: "connection failed" },
    })

    const supabase = createSupabaseClient()

    const result = await regenerateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      questionId,
      attemptId,
    })

    expect(result).toEqual(failure("QUESTIONS_LOAD_FAILED"))
    expect(mockRegenerateWorksheetQuestion).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects missing generation settings", async () => {
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow({ generation_settings: null }),
      error: null,
    })
    mockWorksheetQuestions([validWorksheetQuestion])

    const supabase = createSupabaseClient()

    const result = await regenerateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      questionId,
      attemptId,
    })

    expect(result).toEqual(failure("GENERATION_SETTINGS_MISSING"))
    expect(mockRegenerateWorksheetQuestion).not.toHaveBeenCalled()
  })

  it("returns AI errors without deducting credits", async () => {
    mockRegenerateWorksheetQuestion.mockRejectedValue(new Error("model timeout"))

    const supabase = createSupabaseClient()

    const result = await regenerateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      questionId,
      attemptId,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe("model timeout")
    }
    expect(mockRpc).toHaveBeenNthCalledWith(1, "reserve_regenerate_question_credit", expect.any(Object))
    expect(mockRpc).toHaveBeenNthCalledWith(
      2,
      "cancel_regenerate_question_reservation",
      expect.objectContaining({
        p_reservation_id: reservationId,
        p_idempotency_key: regenerateIdempotencyKey,
      })
    )
  })

  it("cancels the reservation when complete rpc fails after AI succeeds", async () => {
    mockRegenerateReservationFlow({
      completeError: { message: "complete failed" },
    })

    const supabase = createSupabaseClient()

    const result = await regenerateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      questionId,
      attemptId,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe("Could not regenerate the question. No credits were spent.")
    }
    expect(mockRpc).toHaveBeenNthCalledWith(
      3,
      "cancel_regenerate_question_reservation",
      expect.objectContaining({
        p_reservation_id: reservationId,
        p_idempotency_key: regenerateIdempotencyKey,
      })
    )
  })

  it("maps invalid complete responses to regenerate failure code", async () => {
    mockRpc.mockImplementation((name: string) => {
      switch (name) {
        case "reserve_regenerate_question_credit":
          return Promise.resolve({ data: reserveRpcResponse(4), error: null })
        case "complete_regenerate_question_reservation":
          return Promise.resolve({ data: { unexpected: true }, error: null })
        default:
          return Promise.resolve({ data: null, error: null })
      }
    })
    mockRegenerateWorksheetQuestion.mockResolvedValue(validGeneratedQuestion)

    const supabase = createSupabaseClient()

    const result = await regenerateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      questionId,
      attemptId,
    })

    expect(result).toEqual(failure("REGENERATE_FAILED"))
    expect(mockRpc).toHaveBeenNthCalledWith(
      3,
      "cancel_regenerate_question_reservation",
      expect.objectContaining({
        p_reservation_id: reservationId,
        p_idempotency_key: regenerateIdempotencyKey,
      })
    )
  })

  it("does not cancel when complete returns a DB-side refund failure", async () => {
    mockRpc.mockImplementation((name: string) => {
      switch (name) {
        case "reserve_regenerate_question_credit":
          return Promise.resolve({ data: reserveRpcResponse(4), error: null })
        case "complete_regenerate_question_reservation":
          return Promise.resolve({
            data: completeFailureRpcResponse({
              message: "Worksheet or question not found",
            }),
            error: null,
          })
        default:
          return Promise.resolve({ data: null, error: null })
      }
    })

    const supabase = createSupabaseClient()

    const result = await regenerateQuestionForWorksheet({
      supabase,
      profileId,
      worksheetId,
      questionId,
      attemptId,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe("Question not found.")
    }
    expect(mockRpc).toHaveBeenCalledTimes(2)
    expect(mockRpc).not.toHaveBeenCalledWith(
      "cancel_regenerate_question_reservation",
      expect.any(Object)
    )
  })
})

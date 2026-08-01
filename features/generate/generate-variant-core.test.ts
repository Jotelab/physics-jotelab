import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  makeWorksheetQuestions,
  reservationId,
  validGeneratedVariantQuestion,
  validVariantRoll,
  variantCompleteFailureRpcResponse,
  variantCompleteRpcResponse,
  variantReserveAlreadyCompletedResponse,
  variantReserveRpcResponse,
} from "@/tests/fixtures/worksheet-question"

const mockRpc = vi.fn()
const mockWorksheetsSingle = vi.fn()
const mockWorksheetQuestionsOrder = vi.fn()
const mockVariantWorksheetQuestion = vi.fn()
const mockGenerateEngineQuestion = vi.fn()

vi.mock("@/lib/ai/variant-question", () => ({
  variantWorksheetQuestion: (...args: unknown[]) => mockVariantWorksheetQuestion(...args),
}))

vi.mock("@/lib/ai/generate-engine-question", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/ai/generate-engine-question")>()
  return {
    ...actual,
    generateEngineQuestion: (...args: unknown[]) => mockGenerateEngineQuestion(...args),
  }
})

function createSupabaseClient() {
  return asSupabaseClient({
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

      throw new Error(`Unexpected table: ${table}`)
    }),
    rpc: mockRpc,
  })
}

import { generateVariantRollForQuestion } from "./generate-variant-core"
import { failure } from "./errors"
import { buildVariantRollIdempotencyKey } from "./utils/idempotency-key"
import { asSupabaseClient } from "../../tests/mocks/supabase-client"

const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
const profileId = "11111111-1111-4111-8111-111111111111"
const otherProfileId = "22222222-2222-4222-8222-222222222222"
const variantLabel = "B" as const
const order = 1
const variantIdempotencyKey = buildVariantRollIdempotencyKey(worksheetId, variantLabel, order)
const fullWorksheetQuestions = makeWorksheetQuestions(5)

function makeWorksheetRow(
  overrides: Partial<{
    id: string
    user_id: string
    question_count: number
    generation_settings: unknown
  }> = {}
) {
  return {
    id: worksheetId,
    user_id: profileId,
    question_count: 5,
    generation_settings: { lesson: "Motion", scenario: "Find velocity." },
    ...overrides,
  }
}

function makeWorksheetQuestionRows(questions: typeof fullWorksheetQuestions = fullWorksheetQuestions) {
  return questions.map((question) => ({
    id: question.id,
    worksheet_id: worksheetId,
    question_order: question.order,
    question_text: question.question_text,
    given_values: question.given_values,
    target_variable: question.target_variable,
    solution: question.solution,
    ...(question.sympy_data ? { sympy_data: question.sympy_data } : {}),
  }))
}

function mockWorksheetQuestions(questions: typeof fullWorksheetQuestions = fullWorksheetQuestions) {
  mockWorksheetQuestionsOrder.mockResolvedValue({
    data: makeWorksheetQuestionRows(questions),
    error: null,
  })
}

function mockVariantReservationFlow({
  reserveCreditBalance = 41,
  completeCreditBalance = 41,
  reserveError = null as { message: string } | null,
  completeError = null as { message: string } | null,
} = {}) {
  mockRpc.mockImplementation((name: string) => {
    switch (name) {
      case "reserve_variant_roll_credit":
        return Promise.resolve({
          data: reserveError ? null : variantReserveRpcResponse(reserveCreditBalance),
          error: reserveError,
        })
      case "complete_variant_roll_reservation":
        return Promise.resolve({
          data: completeError ? null : variantCompleteRpcResponse({ creditBalance: completeCreditBalance }),
          error: completeError,
        })
      case "cancel_variant_roll_reservation":
        return Promise.resolve({ data: { creditBalance: 42 }, error: null })
      default:
        return Promise.resolve({ data: null, error: { message: `Unexpected rpc: ${name}` } })
    }
  })
}

describe("generateVariantRollForQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow(),
      error: null,
    })
    mockWorksheetQuestions()
    mockVariantWorksheetQuestion.mockResolvedValue(validGeneratedVariantQuestion)
  })

  it("generates and saves a variant roll", async () => {
    mockVariantReservationFlow()

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.creditBalance).toBe(41)
      expect(result.data.roll.order).toBe(1)
      expect(result.data.roll).toEqual(validVariantRoll)
    }
    expect(mockVariantWorksheetQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        masterQuestion: fullWorksheetQuestions[0],
        variantLabel,
        mathComplexity: "integers",
      })
    )
    expect(mockRpc).toHaveBeenNthCalledWith(
      1,
      "reserve_variant_roll_credit",
      expect.objectContaining({
        p_worksheet_id: worksheetId,
        p_variant_label: variantLabel,
        p_order: order,
        p_idempotency_key: variantIdempotencyKey,
      })
    )
    expect(mockRpc).toHaveBeenNthCalledWith(
      2,
      "complete_variant_roll_reservation",
      expect.objectContaining({
        p_reservation_id: reservationId,
        p_idempotency_key: variantIdempotencyKey,
        p_roll: expect.objectContaining({
          order: 1,
          question_text: validGeneratedVariantQuestion.question_text,
        }),
      })
    )
  })

  it("skips AI when reserve reports the roll already completed", async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === "reserve_variant_roll_credit") {
        return Promise.resolve({ data: variantReserveAlreadyCompletedResponse(41), error: null })
      }
      return Promise.resolve({ data: null, error: { message: `Unexpected rpc: ${name}` } })
    })

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.roll).toEqual(validVariantRoll)
      expect(result.data.creditBalance).toBe(41)
    }
    expect(mockVariantWorksheetQuestion).not.toHaveBeenCalled()
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it("rejects when the worksheet belongs to another profile", async () => {
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow({ user_id: otherProfileId }),
      error: null,
    })

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result).toEqual(failure("WORKSHEET_ACCESS_DENIED"))
    expect(mockVariantWorksheetQuestion).not.toHaveBeenCalled()
  })

  it("rejects when the worksheet cannot be loaded", async () => {
    mockWorksheetsSingle.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    })

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result).toEqual(failure("WORKSHEET_ACCESS_DENIED"))
    expect(mockVariantWorksheetQuestion).not.toHaveBeenCalled()
  })

  it("rejects orders beyond the worksheet question count", async () => {
    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order: 6,
    })

    expect(result).toEqual(failure("WORKSHEET_ALREADY_COMPLETE"))
    expect(mockVariantWorksheetQuestion).not.toHaveBeenCalled()
  })

  it("rejects when the requested question order does not exist", async () => {
    mockWorksheetQuestions(makeWorksheetQuestions(5).map((question, index) => ({
      ...question,
      order: index + 2,
    })))

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order: 1,
    })

    expect(result).toEqual(failure("QUESTION_NOT_FOUND"))
    expect(mockVariantWorksheetQuestion).not.toHaveBeenCalled()
  })

  it("does not call AI when credit reservation fails", async () => {
    mockVariantReservationFlow({
      reserveError: { message: "Insufficient credits" },
    })

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result).toEqual(failure("INSUFFICIENT_CREDITS"))
    expect(mockVariantWorksheetQuestion).not.toHaveBeenCalled()
  })

  it("returns structured reserve failures from the rpc body", async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === "reserve_variant_roll_credit") {
        return Promise.resolve({
          data: {
            success: false,
            code: "INSUFFICIENT_CREDITS",
            message: "You do not have enough credits.",
            creditBalance: 0,
          },
          error: null,
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result).toEqual(failure("INSUFFICIENT_CREDITS"))
    expect(mockVariantWorksheetQuestion).not.toHaveBeenCalled()
  })

  it("returns load failed when questions cannot be fetched", async () => {
    mockWorksheetQuestionsOrder.mockResolvedValue({
      data: null,
      error: { message: "connection failed" },
    })

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result).toEqual(failure("QUESTIONS_LOAD_FAILED"))
    expect(mockVariantWorksheetQuestion).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects when the worksheet is not fully generated", async () => {
    mockWorksheetQuestions(makeWorksheetQuestions(3))

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result).toEqual(
      failure("VALIDATION_FAILED", "Worksheet must be fully generated before creating variants.")
    )
    expect(mockVariantWorksheetQuestion).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("uses default math complexity when generation settings are missing", async () => {
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow({ generation_settings: {} }),
      error: null,
    })
    mockVariantReservationFlow()

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result.ok).toBe(true)
    expect(mockVariantWorksheetQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        mathComplexity: "integers",
      })
    )
  })

  it("returns AI errors and cancels the reservation", async () => {
    mockVariantReservationFlow()
    mockVariantWorksheetQuestion.mockRejectedValue(new Error("model timeout"))

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe("model timeout")
    }
    expect(mockRpc).toHaveBeenNthCalledWith(
      2,
      "cancel_variant_roll_reservation",
      expect.objectContaining({
        p_reservation_id: reservationId,
        p_idempotency_key: variantIdempotencyKey,
      })
    )
  })

  it("cancels the reservation when complete rpc fails after AI succeeds", async () => {
    mockVariantReservationFlow({
      completeError: { message: "complete failed" },
    })

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result).toEqual(failure("VARIANT_FAILED"))
    expect(mockRpc).toHaveBeenNthCalledWith(
      3,
      "cancel_variant_roll_reservation",
      expect.objectContaining({ p_reservation_id: reservationId })
    )
  })

  it("maps invalid complete responses to variant failure and cancels", async () => {
    mockRpc.mockImplementation((name: string) => {
      switch (name) {
        case "reserve_variant_roll_credit":
          return Promise.resolve({ data: variantReserveRpcResponse(41), error: null })
        case "complete_variant_roll_reservation":
          return Promise.resolve({ data: { unexpected: true }, error: null })
        case "cancel_variant_roll_reservation":
          return Promise.resolve({ data: { creditBalance: 42 }, error: null })
        default:
          return Promise.resolve({ data: null, error: null })
      }
    })

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result).toEqual(failure("SAVE_FAILED", "Invalid complete response."))
    expect(mockRpc).toHaveBeenNthCalledWith(
      3,
      "cancel_variant_roll_reservation",
      expect.objectContaining({
        p_reservation_id: reservationId,
        p_idempotency_key: variantIdempotencyKey,
      })
    )
  })

  it("cancels the reservation when complete returns a DB-side refund failure", async () => {
    mockRpc.mockImplementation((name: string) => {
      switch (name) {
        case "reserve_variant_roll_credit":
          return Promise.resolve({ data: variantReserveRpcResponse(41), error: null })
        case "complete_variant_roll_reservation":
          return Promise.resolve({
            data: variantCompleteFailureRpcResponse({
              message: "Worksheet not found or already complete",
            }),
            error: null,
          })
        case "cancel_variant_roll_reservation":
          return Promise.resolve({ data: { creditBalance: 42 }, error: null })
        default:
          return Promise.resolve({ data: null, error: null })
      }
    })

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result).toEqual(failure("WORKSHEET_ALREADY_COMPLETE"))
    expect(mockRpc).toHaveBeenNthCalledWith(
      3,
      "cancel_variant_roll_reservation",
      expect.objectContaining({
        p_reservation_id: reservationId,
        p_idempotency_key: variantIdempotencyKey,
      })
    )
  })

  it("omits question_text when the variant matches the master question", async () => {
    mockVariantReservationFlow()
    mockVariantWorksheetQuestion.mockResolvedValue({
      ...validGeneratedVariantQuestion,
      question_text: fullWorksheetQuestions[0].question_text,
    })

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result.ok).toBe(true)
    expect(mockRpc).toHaveBeenNthCalledWith(
      2,
      "complete_variant_roll_reservation",
      expect.objectContaining({
        p_roll: expect.not.objectContaining({
          question_text: expect.anything(),
        }),
      })
    )
  })

  it("returns variant failure when reserve response cannot be parsed", async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === "reserve_variant_roll_credit") {
        return Promise.resolve({ data: { reservationId, creditBalance: "bad" }, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result).toEqual(failure("VARIANT_FAILED"))
    expect(mockVariantWorksheetQuestion).not.toHaveBeenCalled()
  })
})

describe("generateVariantRollForQuestion (engine-backed master)", () => {
  const masterSympyData = {
    topic: "suvat",
    seed: 11,
    given: [
      { symbol: "u", value: 0, exact: "0", unit: "m/s" },
      { symbol: "a", value: 2, exact: "2", unit: "m/s^2" },
      { symbol: "t", value: 5, exact: "5", unit: "s" },
    ],
    find: { symbol: "v", value: 10, exact: "10", unit: "m/s" },
    steps: [
      {
        expr_latex: "v = u + a t",
        substituted_latex: "v = 0 + 2 \cdot 5",
        result_latex: "v = 10\ \text{m/s}",
      },
    ],
    final_answer: { value: 10, exact: "10", unit: "m/s", latex: "10\ \text{m/s}" },
    policy_applied: "easy",
    plausible: true,
  }

  const rerolledSympyData = {
    ...masterSympyData,
    seed: 12,
    given: [
      { symbol: "u", value: 0, exact: "0", unit: "m/s" },
      { symbol: "a", value: 3, exact: "3", unit: "m/s^2" },
      { symbol: "t", value: 4, exact: "4", unit: "s" },
    ],
    find: { symbol: "v", value: 12, exact: "12", unit: "m/s" },
    final_answer: { value: 12, exact: "12", unit: "m/s", latex: "12\ \text{m/s}" },
  }

  const engineMaster = { ...fullWorksheetQuestions[0]!, sympy_data: masterSympyData }
  const engineQuestions = [engineMaster, ...fullWorksheetQuestions.slice(1)]

  const engineGeneratedQuestion = {
    format: "calculation" as const,
    question_text: "รถมีความเร่ง 3 m/s² เป็นเวลา 4 วินาที จงหาความเร็วปลาย",
    given_values: [
      { symbol: "v₀", label: "ความเร็วต้น", value: 0, unit: "m/s" },
      { symbol: "a", label: "ความเร่ง", value: 3, unit: "m/s²" },
      { symbol: "t", label: "เวลา", value: 4, unit: "s" },
    ],
    target_variable: { symbol: "v", label: "ความเร็วปลาย", unit: "m/s" },
    solution: {
      steps: ["$v = u + a t$", "$v = 0 + 3 \cdot 4$", "$v = 12\ \text{m/s}$"],
      final_answer: "$12\ \text{m/s}$",
    },
    sympy_data: rerolledSympyData,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow({
        generation_settings: { lesson: "motion-1d", scenario: "โจทย์การเคลื่อนที่" },
      }),
      error: null,
    })
    mockWorksheetQuestions(engineQuestions)
    mockGenerateEngineQuestion.mockResolvedValue(engineGeneratedQuestion)
  })

  it("re-rolls through the engine with the master's Given/Find split and stores sympy_data", async () => {
    mockVariantReservationFlow()

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result.ok).toBe(true)
    expect(mockVariantWorksheetQuestion).not.toHaveBeenCalled()
    expect(mockGenerateEngineQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        lesson: "motion-1d",
        given: ["u", "a", "t"],
        find: "v",
        previousQuestionsContext: [engineMaster.question_text],
      })
    )
    expect(mockRpc).toHaveBeenCalledWith(
      "complete_variant_roll_reservation",
      expect.objectContaining({
        p_roll: expect.objectContaining({
          order: 1,
          question_text: engineGeneratedQuestion.question_text,
          sympy_data: rerolledSympyData,
        }),
      })
    )
  })

  it("stays on the LLM variant path when the master has no engine payload", async () => {
    mockWorksheetQuestions(fullWorksheetQuestions)
    mockVariantWorksheetQuestion.mockResolvedValue(validGeneratedVariantQuestion)
    mockVariantReservationFlow()

    const supabase = createSupabaseClient()

    const result = await generateVariantRollForQuestion({
      supabase,
      profileId,
      worksheetId,
      label: variantLabel,
      order,
    })

    expect(result.ok).toBe(true)
    expect(mockGenerateEngineQuestion).not.toHaveBeenCalled()
    expect(mockVariantWorksheetQuestion).toHaveBeenCalled()
  })
})

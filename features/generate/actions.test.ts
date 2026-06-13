import { beforeEach, describe, expect, it, vi } from "vitest"

import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

const mockGetUser = vi.fn()
const mockRpc = vi.fn()
const mockWorksheetsSingle = vi.fn()
const mockWorksheetQuestionsOrder = vi.fn()
const mockProfilesSingle = vi.fn()
const mockRegenerateQuestionForWorksheet = vi.fn()

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

      throw new Error(`Unexpected table: ${table}`)
    }),
    rpc: mockRpc,
  })),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("./generate-question-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./generate-question-core")>()
  return {
    ...actual,
    regenerateQuestionForWorksheet: (...args: unknown[]) =>
      mockRegenerateQuestionForWorksheet(...args),
  }
})

import {
  editQuestionAction,
  getWorksheetQuestionCountAction,
  regenerateQuestionAction,
} from "./actions"
import { failure } from "./errors"
import { revalidatePath } from "next/cache"

const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
const profileId = "11111111-1111-4111-8111-111111111111"
const questionId = validWorksheetQuestion.id

function makeWorksheetRow(
  overrides: Partial<{
    id: string
    subject: "math" | "physics" | "chemistry"
    question_count: number
    generation_settings: unknown
  }> = {}
) {
  return {
    id: worksheetId,
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

describe("getWorksheetQuestionCountAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mockWorksheetQuestions()
  })

  it("returns question_count for an owned worksheet", async () => {
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow({ question_count: 15 }),
      error: null,
    })

    const result = await getWorksheetQuestionCountAction(worksheetId)

    expect(result).toEqual({ ok: true, data: { questionCount: 15 } })
  })

  it("rejects invalid worksheet ids", async () => {
    const result = await getWorksheetQuestionCountAction("not-a-uuid")

    expect(result).toEqual(failure("VALIDATION_FAILED", "Invalid worksheet."))
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("returns not found when the worksheet is missing", async () => {
    mockWorksheetsSingle.mockResolvedValue({ data: null, error: { message: "not found" } })

    const result = await getWorksheetQuestionCountAction(worksheetId)

    expect(result).toEqual(failure("WORKSHEET_ACCESS_DENIED"))
  })

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await getWorksheetQuestionCountAction(worksheetId)

    expect(result).toEqual(
      failure("NOT_AUTHENTICATED", "You must be logged in to view this worksheet.")
    )
  })
})

describe("editQuestionAction", () => {
  const editedQuestion = {
    ...validWorksheetQuestion,
    question_text: "Edited question text",
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mockWorksheetsSingle.mockResolvedValue({
      data: makeWorksheetRow(),
      error: null,
    })
    mockWorksheetQuestions([validWorksheetQuestion])
  })

  it("saves an edited question and preserves id and order", async () => {
    mockRpc.mockResolvedValue({
      data: editedQuestion,
      error: null,
    })

    const result = await editQuestionAction({
      worksheetId,
      questionId,
      editedQuestion: {
        ...editedQuestion,
        id: "00000000-0000-4000-8000-000000000099",
        order: 99,
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.question.id).toBe(questionId)
      expect(result.data.question.order).toBe(1)
      expect(result.data.question.question_text).toBe("Edited question text")
    }
    expect(mockRpc).toHaveBeenCalledWith(
      "replace_worksheet_question",
      expect.objectContaining({
        p_worksheet_id: worksheetId,
        p_question_id: questionId,
      })
    )
  })

  it("rejects invalid edited question fields", async () => {
    const result = await editQuestionAction({
      worksheetId,
      questionId,
      editedQuestion: {
        ...editedQuestion,
        question_text: "",
      },
    })

    expect(result).toEqual(failure("VALIDATION_FAILED", "Please check the edited question fields."))
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await editQuestionAction({
      worksheetId,
      questionId,
      editedQuestion,
    })

    expect(result).toEqual(failure("NOT_AUTHENTICATED", "You must be logged in to edit a question."))
  })

  it("returns not found when the question does not exist", async () => {
    const result = await editQuestionAction({
      worksheetId,
      questionId: "00000000-0000-4000-8000-000000000099",
      editedQuestion,
    })

    expect(result).toEqual(failure("QUESTION_NOT_FOUND"))
  })

  it("returns load failed when questions cannot be fetched", async () => {
    mockWorksheetQuestionsOrder.mockResolvedValue({
      data: null,
      error: { message: "connection failed" },
    })

    const result = await editQuestionAction({
      worksheetId,
      questionId,
      editedQuestion,
    })

    expect(result).toEqual(failure("QUESTIONS_LOAD_FAILED"))
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("returns an error when replace rpc fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "replace failed" } })

    const result = await editQuestionAction({
      worksheetId,
      questionId,
      editedQuestion,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe("Could not save the edited question.")
    }
  })
})

describe("regenerateQuestionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mockProfilesSingle.mockResolvedValue({
      data: { id: profileId },
      error: null,
    })
    mockRegenerateQuestionForWorksheet.mockResolvedValue({
      ok: true,
      data: {
        question: validWorksheetQuestion,
        creditBalance: 4,
      },
    })
  })

  it("rejects invalid input", async () => {
    const result = await regenerateQuestionAction({
      worksheetId: "not-a-uuid",
      questionId,
    })

    expect(result).toEqual(failure("VALIDATION_FAILED", "Could not regenerate the question."))
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockRegenerateQuestionForWorksheet).not.toHaveBeenCalled()
  })

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await regenerateQuestionAction({
      worksheetId,
      questionId,
    })

    expect(result).toEqual(
      failure("NOT_AUTHENTICATED", "You must be logged in to regenerate a question.")
    )
    expect(mockRegenerateQuestionForWorksheet).not.toHaveBeenCalled()
  })

  it("delegates to regenerateQuestionForWorksheet and revalidates on success", async () => {
    const result = await regenerateQuestionAction({
      worksheetId,
      questionId,
    })

    expect(result).toEqual({
      ok: true,
      data: {
        question: validWorksheetQuestion,
        creditBalance: 4,
      },
    })
    expect(mockRegenerateQuestionForWorksheet).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId,
        worksheetId,
        questionId,
      })
    )
    expect(revalidatePath).toHaveBeenCalledWith("/generate")
  })
})

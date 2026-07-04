import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

import { fetchWorksheetQuestions } from "./fetch-worksheet-questions"

const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
const mockOrder = vi.fn()
const mockGt = vi.fn(() => ({ order: mockOrder }))

function createSupabaseClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === "worksheet_questions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              gt: mockGt,
              order: mockOrder,
            })),
          })),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  } as unknown as SupabaseClient
}

function makeRow(question: typeof validWorksheetQuestion) {
  return {
    id: question.id,
    worksheet_id: worksheetId,
    question_order: question.order,
    question_text: question.question_text,
    given_values: question.given_values,
    target_variable: question.target_variable,
    solution: question.solution,
  }
}

describe("fetchWorksheetQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns parsed questions when the query succeeds", async () => {
    mockOrder.mockResolvedValue({
      data: [makeRow(validWorksheetQuestion)],
      error: null,
    })

    const result = await fetchWorksheetQuestions(createSupabaseClient(), worksheetId)

    expect(result).toEqual([validWorksheetQuestion])
    expect(mockGt).not.toHaveBeenCalled()
  })

  it("filters to questions past sinceOrder when given", async () => {
    mockOrder.mockResolvedValue({
      data: [makeRow({ ...validWorksheetQuestion, order: 3 })],
      error: null,
    })

    const result = await fetchWorksheetQuestions(createSupabaseClient(), worksheetId, 2)

    expect(result).toEqual([{ ...validWorksheetQuestion, order: 3 }])
    expect(mockGt).toHaveBeenCalledWith("question_order", 2)
  })

  it("returns an empty array when the worksheet has no questions", async () => {
    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    })

    const result = await fetchWorksheetQuestions(createSupabaseClient(), worksheetId)

    expect(result).toEqual([])
  })

  it("returns null when the query fails", async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: "connection failed" },
    })

    const result = await fetchWorksheetQuestions(createSupabaseClient(), worksheetId)

    expect(result).toBeNull()
  })

  it("returns null when data is missing", async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: null,
    })

    const result = await fetchWorksheetQuestions(createSupabaseClient(), worksheetId)

    expect(result).toBeNull()
  })

  it("returns null when row data fails schema validation", async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          ...makeRow(validWorksheetQuestion),
          question_text: "",
        },
      ],
      error: null,
    })

    const result = await fetchWorksheetQuestions(createSupabaseClient(), worksheetId)

    expect(result).toBeNull()
  })
})

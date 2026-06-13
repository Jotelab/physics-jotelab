import { describe, expect, it } from "vitest"

import { mapWorksheetListRowToSummary } from "./map-worksheet-summary"

describe("mapWorksheetListRowToSummary", () => {
  it("maps saved_question_count to actualQuestionCount", () => {
    const result = mapWorksheetListRowToSummary({
      id: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
      title: "Physics: Motion",
      subject: "physics",
      question_count: 5,
      saved_question_count: 3,
      created_at: "2026-06-01T12:00:00.000Z",
    })

    expect(result).toEqual({
      id: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
      title: "Physics: Motion",
      subject: "physics",
      expectedQuestionCount: 5,
      actualQuestionCount: 3,
      createdAt: "2026-06-01T12:00:00.000Z",
    })
  })
})

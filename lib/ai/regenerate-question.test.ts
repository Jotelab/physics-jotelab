import { beforeEach, describe, expect, it, vi } from "vitest"

import { validGeneratedQuestion } from "@/tests/fixtures/worksheet-question"

const mockGenerateObject = vi.fn()

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>()
  return {
    ...actual,
    generateObject: (...args: unknown[]) => mockGenerateObject(...args),
  }
})

vi.mock("./client", () => ({
  getGenerationModel: vi.fn(() => "mock-model"),
}))

import { regenerateWorksheetQuestion } from "./regenerate-question"

describe("regenerateWorksheetQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns a normalized replacement question", async () => {
    mockGenerateObject.mockResolvedValue({ object: validGeneratedQuestion })

    const result = await regenerateWorksheetQuestion({
      subject: "math",
      lesson: "Algebra",
      scenario: "Solve for x",
      existingQuestionText: "Find the value of $x$ when $a = 2$.",
    })

    expect(result.question_text).toBe(validGeneratedQuestion.question_text)
    expect(result.given_values[0]?.value).toBe(2)
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Find the value of $x$ when $a = 2$."),
      })
    )
  })

  it("throws a user-facing error when regeneration fails", async () => {
    mockGenerateObject.mockRejectedValue(new Error("rate limited"))

    await expect(
      regenerateWorksheetQuestion({
        subject: "physics",
        lesson: "Motion",
        scenario: "Find velocity",
        existingQuestionText: "Old question text",
      })
    ).rejects.toThrow("rate limited")
  })
})

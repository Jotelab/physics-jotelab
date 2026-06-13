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

import { generateWorksheetQuestion } from "./generate-question"

describe("generateWorksheetQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns a normalized question from the model response", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        ...validGeneratedQuestion,
        question_text: "  จงหา x  ",
      },
    })

    const result = await generateWorksheetQuestion({
      subject: "math",
      lesson: "Algebra",
      scenario: "Solve for x",
      previousQuestionsContext: [],
    })

    expect(result.question_text).toBe("จงหา x")
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
        prompt: expect.stringContaining("None yet."),
      })
    )
  })

  it("lists previous questions in the prompt", async () => {
    mockGenerateObject.mockResolvedValue({ object: validGeneratedQuestion })

    await generateWorksheetQuestion({
      subject: "physics",
      lesson: "Motion",
      scenario: "Find velocity",
      previousQuestionsContext: ["Question from slot 1"],
    })

    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("1. Question from slot 1"),
      })
    )
  })

  it("throws a user-facing error when generation fails", async () => {
    mockGenerateObject.mockRejectedValue(new Error("API unavailable"))

    await expect(
      generateWorksheetQuestion({
        subject: "chemistry",
        lesson: "Stoichiometry",
        scenario: "Balance the equation",
        previousQuestionsContext: [],
      })
    ).rejects.toThrow("API unavailable")
  })
})

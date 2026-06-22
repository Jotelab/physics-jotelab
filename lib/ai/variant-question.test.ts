import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  validGeneratedQuestion,
  validWorksheetQuestion,
} from "@/tests/fixtures/worksheet-question"

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

import { variantWorksheetQuestion } from "./variant-question"

describe("variantWorksheetQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("E2E_STUB_GENERATION", "")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns the deterministic E2E stub without calling the model", async () => {
    vi.stubEnv("E2E_STUB_GENERATION", "true")

    const result = await variantWorksheetQuestion({
      masterQuestion: validWorksheetQuestion,
      variantLabel: "B",
    })

    expect(result.question_text).toBe(validWorksheetQuestion.question_text)
    expect(result.given_values[0]?.value).toBe(4)
    expect(result.target_variable).toEqual(validWorksheetQuestion.target_variable)
    expect(mockGenerateObject).not.toHaveBeenCalled()
  })

  it("returns a normalized question from the model response", async () => {
    mockGenerateObject.mockResolvedValue({ object: validGeneratedQuestion })

    const result = await variantWorksheetQuestion({
      masterQuestion: validWorksheetQuestion,
      variantLabel: "B",
    })

    expect(result.question_text).toBe(validGeneratedQuestion.question_text)
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
        prompt: expect.stringContaining("Version B"),
      })
    )
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(validWorksheetQuestion.question_text),
      })
    )
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('"symbol": "a"'),
      })
    )
  })

  it("includes scientific notation rules when mathComplexity is scientific", async () => {
    mockGenerateObject.mockResolvedValue({ object: validGeneratedQuestion })

    await variantWorksheetQuestion({
      masterQuestion: validWorksheetQuestion,
      variantLabel: "C",
      mathComplexity: "scientific",
    })

    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("scientific notation"),
      })
    )
  })

  it("trims whitespace from the model response", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        ...validGeneratedQuestion,
        question_text: "  จงหาค่า $x$  ",
      },
    })

    const result = await variantWorksheetQuestion({
      masterQuestion: validWorksheetQuestion,
      variantLabel: "B",
    })

    expect(result.question_text).toBe("จงหาค่า $x$")
  })

  it("rejects when the variant target symbol does not match the master", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        ...validGeneratedQuestion,
        target_variable: {
          ...validGeneratedQuestion.target_variable,
          symbol: "y",
        },
      },
    })

    await expect(
      variantWorksheetQuestion({
        masterQuestion: validWorksheetQuestion,
        variantLabel: "B",
      })
    ).rejects.toThrow("Variant target variable does not match master question.")
  })

  it("throws a user-facing error when generation fails", async () => {
    mockGenerateObject.mockRejectedValue(new Error("API unavailable"))

    await expect(
      variantWorksheetQuestion({
        masterQuestion: validWorksheetQuestion,
        variantLabel: "B",
      })
    ).rejects.toThrow("API unavailable")
  })
})

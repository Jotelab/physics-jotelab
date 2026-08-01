import { describe, expect, it } from "vitest"

import type { WorksheetQuestion, WorksheetVariant } from "@/features/generate/types"
import {
  allocateVariantLabels,
  getAvailableVersionLabels,
  hasUnsavedVariants,
  mergeSavedAndEphemeralVariants,
  mergeVariantQuestions,
} from "@/features/worksheet/utils/merge-variant-questions"

const masterQuestion: WorksheetQuestion = {
  id: "11111111-1111-4111-8111-111111111111",
  order: 1,
  format: "calculation",
  question_text: "Find $x$",
  given_values: [{ symbol: "a", label: "coefficient", value: 2 }],
  target_variable: { symbol: "x", label: "unknown" },
  solution: { steps: ["step"], final_answer: "5" },
}

const variant: WorksheetVariant = {
  id: "22222222-2222-4222-8222-222222222222",
  label: "B",
  createdAt: "2026-01-01T00:00:00.000Z",
  rolls: [
    {
      order: 1,
      given_values: [{ symbol: "a", label: "coefficient", value: 5 }],
      solution: { steps: ["variant step"], final_answer: "8" },
    },
  ],
}

describe("mergeVariantQuestions", () => {
  it("returns master questions for version A", () => {
    expect(mergeVariantQuestions([masterQuestion], "A", [variant])).toEqual([masterQuestion])
  })

  it("merges roll values for version B", () => {
    const merged = mergeVariantQuestions([masterQuestion], "B", [variant])[0]

    expect(merged.id).toBe(`${masterQuestion.id}:B`)
    expect(merged.given_values[0]?.value).toBe(5)
    expect(merged.solution.final_answer).toBe("8")
    expect(merged.question_text).toBe(masterQuestion.question_text)
    expect(merged.target_variable).toEqual(masterQuestion.target_variable)
  })

  it("falls back to master when variant is missing", () => {
    expect(mergeVariantQuestions([masterQuestion], "C", [])).toEqual([masterQuestion])
  })
})

describe("variant helpers", () => {
  it("lists available version labels", () => {
    expect(getAvailableVersionLabels([], [])).toEqual(["A"])
    expect(getAvailableVersionLabels([variant], [])).toEqual(["A", "B"])
  })

  it("merges saved and ephemeral variants by label", () => {
    const ephemeral: WorksheetVariant = {
      ...variant,
      rolls: [{ ...variant.rolls[0]!, given_values: [{ symbol: "a", label: "coefficient", value: 9 }] }],
    }

    const merged = mergeSavedAndEphemeralVariants([variant], [ephemeral])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.rolls[0]?.given_values[0]?.value).toBe(9)
  })

  it("detects unsaved ephemeral variants", () => {
    expect(hasUnsavedVariants([variant], [])).toBe(false)
    expect(hasUnsavedVariants([], [variant])).toBe(true)
  })

  it("allocates the next unused variant labels", () => {
    expect(allocateVariantLabels(1, [])).toEqual(["B"])
    expect(allocateVariantLabels(2, [])).toEqual(["B", "C"])
    expect(allocateVariantLabels(1, ["B"])).toEqual(["C"])
    expect(allocateVariantLabels(2, ["B"])).toEqual(["C", "D"])
    expect(allocateVariantLabels(1, ["B", "C"])).toEqual(["D"])
  })

  it("returns null when not enough unused labels remain", () => {
    expect(allocateVariantLabels(2, ["B", "C"])).toBeNull()
    expect(allocateVariantLabels(1, ["B", "C", "D"])).toBeNull()
  })
})

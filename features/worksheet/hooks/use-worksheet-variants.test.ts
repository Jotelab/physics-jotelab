import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { WorksheetQuestion, WorksheetVariant } from "@/features/generate/types"

import { useWorksheetVariants } from "./use-worksheet-variants"

const masterQuestion: WorksheetQuestion = {
  id: "11111111-1111-4111-8111-111111111111",
  order: 1,
  question_text: "Find $x$",
  given_values: [{ symbol: "a", label: "coefficient", value: 2 }],
  target_variable: { symbol: "x", label: "unknown" },
  solution: { steps: ["step"], final_answer: "5" },
}

const savedVariant: WorksheetVariant = {
  id: "22222222-2222-4222-8222-222222222222",
  label: "B",
  createdAt: "2026-01-01T00:00:00.000Z",
  rolls: [
    {
      order: 1,
      given_values: [{ symbol: "a", label: "coefficient", value: 5 }],
      solution: { steps: ["saved step"], final_answer: "8" },
    },
  ],
}

const ephemeralVariant: WorksheetVariant = {
  id: "33333333-3333-4333-8333-333333333333",
  label: "C",
  createdAt: "2026-06-21T00:00:00.000Z",
  rolls: [
    {
      order: 1,
      given_values: [{ symbol: "a", label: "coefficient", value: 9 }],
      solution: { steps: ["ephemeral step"], final_answer: "12" },
    },
  ],
}

const masterQuestions = [masterQuestion]
const savedVariants = [savedVariant]

function renderVariantsHook(saved: WorksheetVariant[] = savedVariants) {
  return renderHook(
    (props: { masterQuestions: WorksheetQuestion[]; savedVariants: WorksheetVariant[] }) =>
      useWorksheetVariants(props),
    {
      initialProps: {
        masterQuestions,
        savedVariants: saved,
      },
    }
  )
}

describe("useWorksheetVariants", () => {
  it("merges master, saved, and ephemeral variants into displayQuestions", () => {
    const { result } = renderVariantsHook()

    expect(result.current.displayQuestions[0]).toEqual(masterQuestion)

    act(() => {
      result.current.replaceEphemeralVariants([ephemeralVariant])
    })

    expect(result.current.allVariants).toHaveLength(2)
    expect(result.current.activeLabel).toBe("C")

    act(() => {
      result.current.setActiveLabel("B")
    })

    expect(result.current.displayQuestions[0]?.given_values[0]?.value).toBe(5)

    act(() => {
      result.current.setActiveLabel("C")
    })

    expect(result.current.displayQuestions[0]?.given_values[0]?.value).toBe(9)
  })

  it("updates displayQuestions when switching active labels", () => {
    const variantC: WorksheetVariant = {
      ...savedVariant,
      id: "44444444-4444-4444-8444-444444444444",
      label: "C",
      rolls: [
        {
          order: 1,
          given_values: [{ symbol: "a", label: "coefficient", value: 7 }],
          solution: { steps: ["c step"], final_answer: "10" },
        },
      ],
    }

    const { result } = renderVariantsHook([savedVariant, variantC])

    expect(result.current.availableLabels).toEqual(["A", "B", "C"])

    act(() => {
      result.current.setActiveLabel("A")
    })
    expect(result.current.displayQuestions[0]?.given_values[0]?.value).toBe(2)

    act(() => {
      result.current.setActiveLabel("B")
    })
    expect(result.current.displayQuestions[0]?.given_values[0]?.value).toBe(5)

    act(() => {
      result.current.setActiveLabel("C")
    })
    expect(result.current.displayQuestions[0]?.given_values[0]?.value).toBe(7)
  })

  it("tracks unsavedVariants for ephemeral generated variants", () => {
    const { result } = renderVariantsHook()

    expect(result.current.unsavedVariants).toBe(false)

    act(() => {
      result.current.replaceEphemeralVariants([ephemeralVariant])
    })

    expect(result.current.unsavedVariants).toBe(true)

    act(() => {
      result.current.markVariantsSaved([savedVariant, ephemeralVariant])
    })

    expect(result.current.unsavedVariants).toBe(false)
    expect(result.current.ephemeralVariants).toEqual([])
    expect(result.current.allVariants).toHaveLength(2)
  })

  it("syncs when savedVariants prop updates and clears ephemeral state", () => {
    const newSavedVariant: WorksheetVariant = {
      ...savedVariant,
      id: "55555555-5555-4555-8555-555555555555",
      label: "D",
      rolls: [
        {
          order: 1,
          given_values: [{ symbol: "a", label: "coefficient", value: 11 }],
          solution: { steps: ["d step"], final_answer: "14" },
        },
      ],
    }

    const { result, rerender } = renderVariantsHook()

    act(() => {
      result.current.replaceEphemeralVariants([ephemeralVariant])
    })

    expect(result.current.availableLabels).toEqual(["A", "B", "C"])

    rerender({
      masterQuestions,
      savedVariants: [savedVariant, newSavedVariant],
    })

    expect(result.current.availableLabels).toEqual(["A", "B", "C", "D"])

    act(() => {
      result.current.clearEphemeralVariants()
    })

    expect(result.current.activeLabel).toBe("A")
    expect(result.current.ephemeralVariants).toEqual([])
    expect(result.current.unsavedVariants).toBe(false)
    expect(result.current.availableLabels).toEqual(["A", "B", "D"])
  })
})

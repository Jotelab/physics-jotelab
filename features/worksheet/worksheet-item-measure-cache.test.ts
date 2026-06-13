import { describe, expect, it } from "vitest"

import type { SkippedSlot } from "@/features/generate/types"
import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"
import { DEFAULT_HEADER_FIELDS } from "@/features/worksheet/types/header"
import {
  buildItemHeights,
  computeDirtyItemIndices,
  getHeaderMeasureFingerprint,
  getItemMeasureFingerprint,
  getItemMeasureKey,
  pruneItemHeightCache,
  type ItemHeightCache,
} from "@/features/worksheet/worksheet-item-measure-cache"
import type { DisplayItem } from "@/features/worksheet/utils"

const questionItem: DisplayItem = {
  type: "question",
  order: 1,
  question: validWorksheetQuestion,
}

const skippedItem: DisplayItem = {
  type: "skipped",
  order: 2,
  skipped: { order: 2, message: "Generation failed" } satisfies SkippedSlot,
}

describe("worksheet-item-measure-cache", () => {
  it("uses question id and skipped order for measure keys", () => {
    expect(getItemMeasureKey(questionItem)).toBe(validWorksheetQuestion.id)
    expect(getItemMeasureKey(skippedItem)).toBe("skipped-2")
  })

  it("changes fingerprint when view mode toggles", () => {
    const worksheet = getItemMeasureFingerprint(questionItem, "worksheet")
    const answer = getItemMeasureFingerprint(questionItem, "answer")

    expect(worksheet).not.toBe(answer)
  })

  it("changes fingerprint when question text changes", () => {
    const original = getItemMeasureFingerprint(questionItem, "worksheet")
    const edited: DisplayItem = {
      type: "question",
      order: 1,
      question: {
        ...validWorksheetQuestion,
        question_text: "Different prompt",
      },
    }

    expect(getItemMeasureFingerprint(edited, "worksheet")).not.toBe(original)
  })

  it("keeps fingerprint stable when only display order metadata differs in item wrapper", () => {
    const first = getItemMeasureFingerprint(questionItem, "worksheet")
    const second = getItemMeasureFingerprint(
      { type: "question", order: 99, question: validWorksheetQuestion },
      "worksheet"
    )

    expect(first).toBe(second)
  })

  it("prunes cache entries that are no longer active", () => {
    const cache: ItemHeightCache = new Map([
      ["a", { fingerprint: "f1", height: 10 }],
      ["b", { fingerprint: "f2", height: 20 }],
    ])

    pruneItemHeightCache(cache, new Set(["a"]))

    expect(cache.has("a")).toBe(true)
    expect(cache.has("b")).toBe(false)
  })

  it("buildItemHeights prefers cache over measurer", () => {
    const cache: ItemHeightCache = new Map([
      [
        getItemMeasureKey(questionItem),
        {
          fingerprint: getItemMeasureFingerprint(questionItem, "worksheet"),
          height: 111,
        },
      ],
    ])

    const heights = buildItemHeights([questionItem, skippedItem], "worksheet", cache, () => 999)

    expect(heights).toEqual([111, 999])
  })

  it("changes header fingerprint when field toggles change", () => {
    const withName = getHeaderMeasureFingerprint(
      "worksheet",
      "Title",
      "Instructions",
      DEFAULT_HEADER_FIELDS
    )
    const withoutName = getHeaderMeasureFingerprint("worksheet", "Title", "Instructions", {
      ...DEFAULT_HEADER_FIELDS,
      showStudentName: false,
    })

    expect(withName).not.toBe(withoutName)
  })

  it("changes header fingerprint when instructions change", () => {
    const first = getHeaderMeasureFingerprint(
      "worksheet",
      "Title",
      "Instructions A",
      DEFAULT_HEADER_FIELDS
    )
    const second = getHeaderMeasureFingerprint(
      "worksheet",
      "Title",
      "Instructions B",
      DEFAULT_HEADER_FIELDS
    )

    expect(first).not.toBe(second)
  })

  it("keeps header fingerprint stable when title and fields are unchanged", () => {
    const first = getHeaderMeasureFingerprint(
      "worksheet",
      "Title",
      "Instructions",
      DEFAULT_HEADER_FIELDS
    )
    const second = getHeaderMeasureFingerprint(
      "worksheet",
      "Title",
      "Instructions",
      DEFAULT_HEADER_FIELDS
    )

    expect(first).toBe(second)
  })

  it("computeDirtyItemIndices lists only cache misses", () => {
    const cache: ItemHeightCache = new Map([
      [
        getItemMeasureKey(questionItem),
        {
          fingerprint: getItemMeasureFingerprint(questionItem, "worksheet"),
          height: 50,
        },
      ],
    ])

    expect(computeDirtyItemIndices([questionItem, skippedItem], "worksheet", cache)).toEqual([
      1,
    ])
  })
})

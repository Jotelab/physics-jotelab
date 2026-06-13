import { describe, expect, it } from "vitest"

import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

import { getDisplayItems } from "./utils"

describe("getDisplayItems", () => {
  it("sorts questions and skipped slots by order", () => {
    const q2 = { ...validWorksheetQuestion, id: "b2b2c3d4-e5f6-4789-a012-3456789abcde", order: 2 }
    const q1 = { ...validWorksheetQuestion, order: 1 }

    const items = getDisplayItems([q2, q1], [
      { order: 3, message: "Skipped due to credits." },
    ])

    expect(items.map((item) => item.order)).toEqual([1, 2, 3])
    expect(items[0]?.type).toBe("question")
    expect(items[2]?.type).toBe("skipped")
  })
})

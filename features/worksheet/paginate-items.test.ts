import { describe, expect, it } from "vitest"

import { WORKSHEET_ITEM_GAP_PX } from "@/features/worksheet/a4"
import { paginateItemHeights } from "@/features/worksheet/paginate-items"

describe("paginateItemHeights", () => {
  it("returns no pages when there are no items", () => {
    expect(paginateItemHeights([], 500, 500)).toEqual({
      pageItemIndices: [],
      overflowPageIndices: [],
    })
  })

  it("fits a single small item on the first page", () => {
    expect(paginateItemHeights([100], 500, 500)).toEqual({
      pageItemIndices: [[0]],
      overflowPageIndices: [],
    })
  })

  it("splits items across pages when they overflow", () => {
    const gap = WORKSHEET_ITEM_GAP_PX
    const firstPageCapacity = 200

    const result = paginateItemHeights([80, 80, 80], firstPageCapacity, 300)

    expect(result.pageItemIndices).toEqual([[0, 1], [2]])
    expect(result.overflowPageIndices).toEqual([])
    expect(80 + gap + 80).toBeLessThanOrEqual(firstPageCapacity)
  })

  it("places an oversized item alone on its own page", () => {
    const result = paginateItemHeights([50, 900, 50], 400, 400)
    expect(result.pageItemIndices).toEqual([[0], [1], [2]])
    expect(result.overflowPageIndices).toEqual([1])
  })
})

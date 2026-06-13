import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"
import { useWorksheetPagination } from "@/features/worksheet/hooks/use-worksheet-pagination"
import { DEFAULT_HEADER_FIELDS } from "@/features/worksheet/types/header"
import type { DisplayItem } from "@/features/worksheet/utils"

vi.mock("@/features/worksheet/measure-mm", () => ({
  measureMmToPx: () => 800,
}))

function mockElementHeight(height: number) {
  return {
    getBoundingClientRect: () => ({ height }),
  } as HTMLDivElement
}

describe("useWorksheetPagination", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reuses cached heights and only measures dirty items after an update", async () => {
    const firstQuestion: DisplayItem = {
      type: "question",
      order: 1,
      question: validWorksheetQuestion,
    }
    const secondQuestion: DisplayItem = {
      type: "question",
      order: 2,
      question: {
        ...validWorksheetQuestion,
        id: "b2b2c3d4-e5f6-4789-a012-3456789abcde",
        order: 2,
      },
    }

    const measureCalls: number[] = []

    const { result, rerender } = renderHook(
      ({ items }: { items: DisplayItem[] }) => {
        const pagination = useWorksheetPagination(
          items,
          "worksheet",
          "Title",
          "Subtitle",
          DEFAULT_HEADER_FIELDS
        )

        pagination.measureItemsRef.current = {
          getBoundingClientRect: () => ({ height: 0 }),
        } as HTMLDivElement

        if (pagination.isHeaderDirty) {
          pagination.headerMeasureRef.current = mockElementHeight(40)
        }

        items.forEach((_, index) => {
          if (!pagination.isItemDirty(index)) {
            pagination.setItemMeasureRef(index, null)
            return
          }

          measureCalls.push(index)
          pagination.setItemMeasureRef(index, mockElementHeight(120))
        })

        return pagination
      },
      { initialProps: { items: [firstQuestion] } }
    )

    await waitFor(() => {
      expect(result.current.pageItemIndices).toEqual([[0]])
      expect(result.current.isItemDirty(0)).toBe(false)
    })

    measureCalls.length = 0
    rerender({ items: [firstQuestion, secondQuestion] })

    await waitFor(() => {
      expect(result.current.pageItemIndices).toEqual([[0, 1]])
      expect(result.current.isItemDirty(1)).toBe(false)
    })

    expect([...new Set(measureCalls)]).toEqual([1])
    expect(result.current.isItemDirty(0)).toBe(false)
    expect(result.current.isItemDirty(1)).toBe(false)
  })
})

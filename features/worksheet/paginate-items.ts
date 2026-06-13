import { WORKSHEET_ITEM_GAP_PX } from "@/features/worksheet/a4"

export type PaginateItemHeightsResult = {
  pageItemIndices: number[][]
  /** Page indices where a single item exceeds the page content height. */
  overflowPageIndices: number[]
}

/** Greedy pack item heights into pages; each page is an array of item indices. */
export function paginateItemHeights(
  itemHeights: number[],
  firstPageContentHeight: number,
  nextPageContentHeight: number
): PaginateItemHeightsResult {
  if (itemHeights.length === 0) {
    return { pageItemIndices: [], overflowPageIndices: [] }
  }

  const pageItemIndices: number[][] = []
  const overflowPageIndices: number[] = []
  let currentPage: number[] = []
  let usedHeight = 0
  let capacity = firstPageContentHeight

  function startNewPage() {
    if (currentPage.length > 0) {
      pageItemIndices.push(currentPage)
    }
    currentPage = []
    usedHeight = 0
    capacity = nextPageContentHeight
  }

  for (let index = 0; index < itemHeights.length; index++) {
    const itemHeight = itemHeights[index] ?? 0
    const gap = currentPage.length > 0 ? WORKSHEET_ITEM_GAP_PX : 0
    const requiredHeight = itemHeight + gap

    if (
      currentPage.length > 0 &&
      (requiredHeight > capacity || usedHeight + requiredHeight > capacity)
    ) {
      startNewPage()
    }

    const gapAfterNewPage = currentPage.length > 0 ? WORKSHEET_ITEM_GAP_PX : 0
    const requiredOnFreshPage = itemHeight + gapAfterNewPage
    const pageCapacity =
      pageItemIndices.length === 0 && currentPage.length === 0
        ? firstPageContentHeight
        : capacity

    if (requiredOnFreshPage > pageCapacity) {
      if (currentPage.length > 0) {
        startNewPage()
      }
      pageItemIndices.push([index])
      overflowPageIndices.push(pageItemIndices.length - 1)
      usedHeight = 0
      capacity = nextPageContentHeight
      continue
    }

    currentPage.push(index)
    usedHeight += requiredOnFreshPage
  }

  if (currentPage.length > 0) {
    pageItemIndices.push(currentPage)
  }

  return { pageItemIndices, overflowPageIndices }
}

import type { WorksheetHeaderFieldToggles } from "@/features/worksheet/types/header"
import type { DisplayItem, WorksheetViewMode } from "@/features/worksheet/utils"

export type ItemHeightCacheEntry = {
  fingerprint: string
  height: number
}

export type ItemHeightCache = Map<string, ItemHeightCacheEntry>

export function getItemMeasureKey(item: DisplayItem): string {
  return item.type === "question" ? item.question.id : `skipped-${item.order}`
}

export function getItemMeasureFingerprint(
  item: DisplayItem,
  viewMode: WorksheetViewMode
): string {
  if (item.type === "question") {
    const question = item.question
    return [
      viewMode,
      question.question_text,
      JSON.stringify(question.given_values),
      JSON.stringify(question.target_variable),
      JSON.stringify(question.solution),
      // A rendered diagram changes the block height, so it must invalidate the
      // measured-height cache. Key on the SVG length
      // rather than the full markup to keep the fingerprint cheap to compare.
      question.diagram_svg ? `svg:${question.diagram_svg.length}` : "",
    ].join("|")
  }

  return [viewMode, item.order, item.skipped.message].join("|")
}

export function getHeaderMeasureFingerprint(
  viewMode: WorksheetViewMode,
  title: string,
  instructions: string,
  fields: WorksheetHeaderFieldToggles
): string {
  return `header:${viewMode}|${title}|${instructions}|${JSON.stringify(fields)}`
}

export function pruneItemHeightCache(cache: ItemHeightCache, activeKeys: Set<string>) {
  for (const key of cache.keys()) {
    if (!activeKeys.has(key)) {
      cache.delete(key)
    }
  }
}

export function getCachedItemHeight(
  item: DisplayItem,
  viewMode: WorksheetViewMode,
  cache: ItemHeightCache
): number | null {
  const key = getItemMeasureKey(item)
  const fingerprint = getItemMeasureFingerprint(item, viewMode)
  const entry = cache.get(key)

  if (!entry || entry.fingerprint !== fingerprint) {
    return null
  }

  return entry.height
}

export function buildItemHeights(
  displayItems: DisplayItem[],
  viewMode: WorksheetViewMode,
  cache: ItemHeightCache,
  measureHeightAtIndex: (index: number) => number
): number[] {
  return displayItems.map((item, index) => {
    const cachedHeight = getCachedItemHeight(item, viewMode, cache)
    if (cachedHeight !== null) {
      return cachedHeight
    }

    return measureHeightAtIndex(index)
  })
}

export function computeDirtyItemIndices(
  displayItems: DisplayItem[],
  viewMode: WorksheetViewMode,
  cache: ItemHeightCache
): number[] {
  const dirtyIndices: number[] = []

  displayItems.forEach((item, index) => {
    if (getCachedItemHeight(item, viewMode, cache) === null) {
      dirtyIndices.push(index)
    }
  })

  return dirtyIndices
}

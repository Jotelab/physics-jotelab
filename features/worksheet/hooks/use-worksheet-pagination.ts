"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"

import {
  A4_CONTENT_HEIGHT_MM,
  A4_CONTENT_WIDTH_MM,
} from "@/features/worksheet/a4"
import { measureMmToPx } from "@/features/worksheet/measure-mm"
import { paginateItemHeights } from "@/features/worksheet/paginate-items"
import {
  buildItemHeights,
  getCachedItemHeight,
  getHeaderMeasureFingerprint,
  getItemMeasureFingerprint,
  getItemMeasureKey,
  pruneItemHeightCache,
  type ItemHeightCache,
} from "@/features/worksheet/worksheet-item-measure-cache"
import type { WorksheetHeaderFieldToggles } from "@/features/worksheet/types/header"
import type { DisplayItem, WorksheetViewMode } from "@/features/worksheet/utils"

const MEASURE_RETRY_FRAMES = 5
const STABLE_FRAMES_REQUIRED = 2

export type WorksheetPaginationState = {
  pageItemIndices: number[][] | null
  overflowPageIndices: number[]
}

type HeaderCacheEntry = {
  fingerprint: string
  height: number
}

type StabilityEntry = {
  lastHeight: number
  stableFrames: number
}

const EMPTY_ITEM_FINGERPRINTS = new Map<string, string>()

function computeDirtyItemIndicesFromFingerprints(
  displayItems: DisplayItem[],
  viewMode: WorksheetViewMode,
  knownItemFingerprints: Map<string, string>
): number[] {
  const dirtyIndices: number[] = []

  displayItems.forEach((item, index) => {
    const key = getItemMeasureKey(item)
    const fingerprint = getItemMeasureFingerprint(item, viewMode)
    if (knownItemFingerprints.get(key) !== fingerprint) {
      dirtyIndices.push(index)
    }
  })

  return dirtyIndices
}

function syncKnownItemFingerprints(cache: ItemHeightCache): Map<string, string> {
  const next = new Map<string, string>()
  for (const [key, entry] of cache) {
    next.set(key, entry.fingerprint)
  }
  return next
}

function fingerprintMapsEqual(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a.size !== b.size) {
    return false
  }

  for (const [key, fingerprint] of a) {
    if (b.get(key) !== fingerprint) {
      return false
    }
  }

  return true
}

function numberArraysEqual(a: number[] | null | undefined, b: number[]): boolean {
  if (a == null) {
    return false
  }

  if (a.length !== b.length) {
    return false
  }

  return a.every((value, index) => value === b[index])
}

function paginationStatesEqual(
  current: WorksheetPaginationState,
  nextPageItemIndices: number[][],
  nextOverflowPageIndices: number[]
): boolean {
  if (current.pageItemIndices == null) {
    return false
  }

  if (current.pageItemIndices.length !== nextPageItemIndices.length) {
    return false
  }

  if (!numberArraysEqual(current.overflowPageIndices, nextOverflowPageIndices)) {
    return false
  }

  return current.pageItemIndices.every((page, pageIndex) =>
    numberArraysEqual(page, nextPageItemIndices[pageIndex] ?? [])
  )
}

export function useWorksheetPagination(
  displayItems: DisplayItem[],
  viewMode: WorksheetViewMode,
  title: string,
  instructions: string,
  headerFields: WorksheetHeaderFieldToggles
) {
  const measureItemsRef = useRef<HTMLDivElement>(null)
  const headerMeasureRef = useRef<HTMLDivElement>(null)
  const itemMeasureRefs = useRef<(HTMLDivElement | null)[]>([])
  const itemHeightCacheRef = useRef<ItemHeightCache>(new Map())
  const headerCacheRef = useRef<HeaderCacheEntry | null>(null)
  const stabilityRef = useRef<Map<string, StabilityEntry>>(new Map())
  const [pagination, setPagination] = useState<WorksheetPaginationState>({
    pageItemIndices: null,
    overflowPageIndices: [],
  })
  const [knownHeaderFingerprint, setKnownHeaderFingerprint] = useState<string | null>(null)
  const [knownItemFingerprints, setKnownItemFingerprints] = useState<Map<string, string>>(
    () => new Map()
  )

  const itemCount = displayItems.length
  const layoutKey = useMemo(
    () =>
      [
        viewMode,
        title,
        instructions,
        JSON.stringify(headerFields),
        displayItems.map((item) => `${getItemMeasureKey(item)}:${getItemMeasureFingerprint(item, viewMode)}`),
      ].join("|"),
    [displayItems, viewMode, title, instructions, headerFields]
  )

  const headerFingerprint = getHeaderMeasureFingerprint(
    viewMode,
    title,
    instructions,
    headerFields
  )
  const renderKnownHeaderFingerprint = itemCount === 0 ? null : knownHeaderFingerprint
  const renderKnownItemFingerprints =
    itemCount === 0 ? EMPTY_ITEM_FINGERPRINTS : knownItemFingerprints
  const isHeaderDirty = renderKnownHeaderFingerprint !== headerFingerprint

  const dirtyIndices = useMemo(
    () =>
      computeDirtyItemIndicesFromFingerprints(
        displayItems,
        viewMode,
        renderKnownItemFingerprints
      ),
    [displayItems, viewMode, renderKnownItemFingerprints]
  )
  const dirtyIndexSet = useMemo(() => new Set(dirtyIndices), [dirtyIndices])

  useLayoutEffect(() => {
    itemMeasureRefs.current.length = itemCount

    if (itemCount === 0) {
      itemHeightCacheRef.current.clear()
      headerCacheRef.current = null
      stabilityRef.current.clear()
      return
    }

    for (const item of displayItems) {
      const key = getItemMeasureKey(item)
      const fingerprint = getItemMeasureFingerprint(item, viewMode)
      const cached = itemHeightCacheRef.current.get(key)
      if (!cached || cached.fingerprint !== fingerprint) {
        stabilityRef.current.delete(key)
      }
    }

    let cancelled = false
    let retryFrame = 0
    let retryId = 0
    const headerNeedsMeasure = knownHeaderFingerprint !== headerFingerprint

    function commitMeasuredItemHeights(itemHeights: number[]) {
      const activeKeys = new Set<string>()

      displayItems.forEach((item, index) => {
        const key = getItemMeasureKey(item)
        const fingerprint = getItemMeasureFingerprint(item, viewMode)
        activeKeys.add(key)

        if (!dirtyIndexSet.has(index)) {
          return
        }

        const height = itemHeights[index] ?? 0
        if (height <= 0) {
          return
        }

        const pending = stabilityRef.current.get(key)
        if (pending && pending.lastHeight === height) {
          const stableFrames = pending.stableFrames + 1
          if (stableFrames >= STABLE_FRAMES_REQUIRED) {
            itemHeightCacheRef.current.set(key, { fingerprint, height })
            stabilityRef.current.delete(key)
          } else {
            stabilityRef.current.set(key, { lastHeight: height, stableFrames })
          }
        } else {
          stabilityRef.current.set(key, { lastHeight: height, stableFrames: 1 })
        }
      })

      pruneItemHeightCache(itemHeightCacheRef.current, activeKeys)
      const nextKnownItemFingerprints = syncKnownItemFingerprints(itemHeightCacheRef.current)
      setKnownItemFingerprints((current) =>
        fingerprintMapsEqual(current, nextKnownItemFingerprints)
          ? current
          : nextKnownItemFingerprints
      )
    }

    function allDirtyItemsCached() {
      return dirtyIndices.every(
        (index) => getCachedItemHeight(displayItems[index]!, viewMode, itemHeightCacheRef.current) !== null
      )
    }

    function measureAndPaginate(): boolean {
      if (cancelled) {
        return true
      }

      const pageContentHeight = measureMmToPx(A4_CONTENT_HEIGHT_MM)
      if (pageContentHeight <= 0) {
        return false
      }

      const headerNeedsMeasure = knownHeaderFingerprint !== headerFingerprint

      let headerHeight = 0
      if (headerNeedsMeasure) {
        headerHeight = headerMeasureRef.current?.getBoundingClientRect().height ?? 0
        if (headerHeight <= 0) {
          return false
        }
        headerCacheRef.current = { fingerprint: headerFingerprint, height: headerHeight }
        setKnownHeaderFingerprint((current) =>
          current === headerFingerprint ? current : headerFingerprint
        )
      } else {
        headerHeight = headerCacheRef.current?.height ?? 0
        if (headerHeight <= 0) {
          return false
        }
      }

      const firstPageContentHeight = Math.max(0, pageContentHeight - headerHeight)

      const itemHeights = buildItemHeights(displayItems, viewMode, itemHeightCacheRef.current, (index) => {
        const element = itemMeasureRefs.current[index]
        return element?.getBoundingClientRect().height ?? 0
      })

      if (!itemHeights.every((height) => height > 0)) {
        return false
      }

      const { pageItemIndices, overflowPageIndices } = paginateItemHeights(
        itemHeights,
        firstPageContentHeight,
        pageContentHeight
      )

      if (pageItemIndices.length === 0) {
        return false
      }

      setPagination((current) =>
        paginationStatesEqual(current, pageItemIndices, overflowPageIndices)
          ? current
          : { pageItemIndices, overflowPageIndices }
      )
      commitMeasuredItemHeights(itemHeights)
      return allDirtyItemsCached()
    }

    function scheduleRetry() {
      if (cancelled || retryFrame >= MEASURE_RETRY_FRAMES) {
        return
      }

      retryFrame += 1
      retryId = requestAnimationFrame(() => {
        if (!measureAndPaginate()) {
          scheduleRetry()
        }
      })
    }

    const resizeObserver = new ResizeObserver(() => {
      measureAndPaginate()
    })

    const measureItems = measureItemsRef.current
    if (measureItems) {
      resizeObserver.observe(measureItems)
    }

    if (headerNeedsMeasure && headerMeasureRef.current) {
      resizeObserver.observe(headerMeasureRef.current)
    }

    for (const index of dirtyIndices) {
      const element = itemMeasureRefs.current[index]
      if (element) {
        resizeObserver.observe(element)
      }
    }

    if (!measureAndPaginate()) {
      scheduleRetry()
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(retryId)
      resizeObserver.disconnect()
    }
  }, [
    itemCount,
    layoutKey,
    headerFingerprint,
    knownHeaderFingerprint,
    dirtyIndices,
    dirtyIndexSet,
    displayItems,
    viewMode,
  ])

  function setItemMeasureRef(index: number, element: HTMLDivElement | null) {
    itemMeasureRefs.current[index] = element
  }

  function isItemDirty(index: number) {
    return dirtyIndexSet.has(index)
  }

  return {
    measureItemsRef,
    headerMeasureRef,
    setItemMeasureRef,
    isHeaderDirty,
    isItemDirty,
    pageItemIndices: itemCount === 0 ? [] : pagination.pageItemIndices,
    overflowPageIndices: itemCount === 0 ? [] : pagination.overflowPageIndices,
    measureContentWidthStyle: { width: `${A4_CONTENT_WIDTH_MM}mm` } as const,
  }
}

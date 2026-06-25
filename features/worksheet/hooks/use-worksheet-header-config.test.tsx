import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useEffect, useRef, type MutableRefObject } from "react"

import { updateWorksheetHeaderAction } from "@/features/worksheet/actions/update-worksheet-header"
import { DEFAULT_HEADER_FIELDS } from "@/features/worksheet/types/header"

import {
  useWorksheetHeaderConfig,
  type WorksheetHeaderChangeHandlers,
} from "./use-worksheet-header-config"

const mockUpdateWorksheetHeaderAction = vi.mocked(updateWorksheetHeaderAction)

const worksheetIdA = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
const worksheetIdB = "b2b2c3d4-e5f6-4789-a012-3456789abcde"

const defaults = {
  defaultTitle: "Physics: Motion",
  defaultInstructions: "5 questions - Find velocity.",
}

type HarnessArgs = Parameters<typeof useWorksheetHeaderConfig>[0]

type HarnessSnapshot = {
  resolvedHeader: ReturnType<typeof useWorksheetHeaderConfig>["resolvedHeader"]
  onHeaderChange: WorksheetHeaderChangeHandlers
}

function HeaderConfigHarness({
  args,
  snapshotRef,
}: {
  args: HarnessArgs
  snapshotRef: MutableRefObject<HarnessSnapshot | null>
}) {
  const result = useWorksheetHeaderConfig(args)
  const onHeaderChangeRef = useRef(result.onHeaderChange)

  useEffect(() => {
    onHeaderChangeRef.current = result.onHeaderChange
    snapshotRef.current = {
      resolvedHeader: result.resolvedHeader,
      onHeaderChange: result.onHeaderChange,
    }
  })

  return null
}

function renderHeaderConfigHarness(args: HarnessArgs) {
  const snapshotRef: MutableRefObject<HarnessSnapshot | null> = { current: null }

  const view = render(<HeaderConfigHarness args={args} snapshotRef={snapshotRef} />)

  return {
    get snapshot() {
      if (!snapshotRef.current) {
        throw new Error("Header config harness did not produce a snapshot")
      }

      return snapshotRef.current
    },
    rerender(nextArgs: HarnessArgs) {
      view.rerender(<HeaderConfigHarness args={nextArgs} snapshotRef={snapshotRef} />)
    },
    unmount: view.unmount,
  }
}

describe("useWorksheetHeaderConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateWorksheetHeaderAction.mockResolvedValue({ ok: true, data: {} })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("hydrates from savedHeader", () => {
    const harness = renderHeaderConfigHarness({
      worksheetId: null,
      ...defaults,
      savedHeader: {
        title: "Saved Title",
        instructions: "Saved instructions.",
        fields: {
          showStudentName: false,
          showDate: false,
          showClassSection: true,
          showScoreBox: false,
        },
      },
    })

    expect(harness.snapshot.resolvedHeader.title).toBe("Saved Title")
  })

  it("syncs default title when title has not been touched", () => {
    const harness = renderHeaderConfigHarness({
      worksheetId: null,
      ...defaults,
    })

    harness.rerender({
      worksheetId: null,
      defaultTitle: "Chemistry: Bonds",
      defaultInstructions: defaults.defaultInstructions,
    })

    expect(harness.snapshot.resolvedHeader.title).toBe("Chemistry: Bonds")
  })

  it("keeps a custom title after it has been touched", () => {
    const harness = renderHeaderConfigHarness({
      worksheetId: null,
      ...defaults,
    })

    act(() => {
      harness.snapshot.onHeaderChange.onTitleChange("Custom Title")
    })

    harness.rerender({
      worksheetId: null,
      defaultTitle: "Chemistry: Bonds",
      defaultInstructions: defaults.defaultInstructions,
    })

    expect(harness.snapshot.resolvedHeader.title).toBe("Custom Title")
  })

  it("preserves pre-generation edits when worksheetId is attached", () => {
    const harness = renderHeaderConfigHarness({
      worksheetId: null,
      ...defaults,
    })

    act(() => {
      harness.snapshot.onHeaderChange.onTitleChange("Draft Title")
      harness.snapshot.onHeaderChange.onFieldsChange({
        ...DEFAULT_HEADER_FIELDS,
        showClassSection: true,
      })
    })

    harness.rerender({
      worksheetId: worksheetIdA,
      ...defaults,
    })

    expect(harness.snapshot.resolvedHeader.title).toBe("Draft Title")
    expect(harness.snapshot.resolvedHeader.fields.showClassSection).toBe(true)
  })

  it("resets to defaults when worksheetId goes from one worksheet to null", () => {
    const harness = renderHeaderConfigHarness({
      worksheetId: worksheetIdA,
      ...defaults,
    })

    act(() => {
      harness.snapshot.onHeaderChange.onTitleChange("Custom Title")
    })

    harness.rerender({
      worksheetId: null,
      ...defaults,
    })

    expect(harness.snapshot.resolvedHeader.title).toBe(defaults.defaultTitle)
  })

  it("resets to defaults when switching between worksheet ids", () => {
    const harness = renderHeaderConfigHarness({
      worksheetId: worksheetIdA,
      ...defaults,
    })

    act(() => {
      harness.snapshot.onHeaderChange.onTitleChange("Custom Title")
    })

    harness.rerender({
      worksheetId: worksheetIdB,
      ...defaults,
    })

    expect(harness.snapshot.resolvedHeader.title).toBe(defaults.defaultTitle)
  })

  it("does not persist when worksheetId is null", async () => {
    const harness = renderHeaderConfigHarness({
      worksheetId: null,
      ...defaults,
    })

    act(() => {
      harness.snapshot.onHeaderChange.onFieldsChange({
        ...DEFAULT_HEADER_FIELDS,
        showScoreBox: true,
      })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(mockUpdateWorksheetHeaderAction).not.toHaveBeenCalled()
  })

  it("debounces persist after field changes", async () => {
    const harness = renderHeaderConfigHarness({
      worksheetId: worksheetIdA,
      ...defaults,
    })

    mockUpdateWorksheetHeaderAction.mockClear()

    act(() => {
      harness.snapshot.onHeaderChange.onFieldsChange({
        ...DEFAULT_HEADER_FIELDS,
        showScoreBox: true,
      })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(mockUpdateWorksheetHeaderAction).toHaveBeenCalledTimes(1)
  })

  it("schedules persist when worksheetId is attached", async () => {
    const harness = renderHeaderConfigHarness({
      worksheetId: null,
      ...defaults,
    })

    act(() => {
      harness.snapshot.onHeaderChange.onTitleChange("Draft Title")
    })

    harness.rerender({
      worksheetId: worksheetIdA,
      ...defaults,
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(mockUpdateWorksheetHeaderAction).toHaveBeenCalledWith(
      expect.objectContaining({
        worksheetId: worksheetIdA,
        resolvedTitle: "Draft Title",
      })
    )
  })
})

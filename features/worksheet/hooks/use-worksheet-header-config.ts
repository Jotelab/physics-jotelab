"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  DEFAULT_HEADER_FIELDS,
  mergeHeaderFields,
  resolveHeaderConfig,
  toPersistedHeaderConfig,
  type ResolvedWorksheetHeader,
  type WorksheetHeaderConfig,
  type WorksheetHeaderFieldToggles,
} from "@/features/worksheet/types/header"

const PERSIST_DEBOUNCE_MS = 500

type UseWorksheetHeaderConfigArgs = {
  worksheetId: string | null
  defaultTitle: string
  defaultInstructions: string
  savedHeader?: WorksheetHeaderConfig | null
}

export type WorksheetHeaderChangeHandlers = {
  onTitleChange: (title: string) => void
  onInstructionsChange: (instructions: string) => void
  onFieldsChange: (fields: WorksheetHeaderFieldToggles) => void
}

export function useWorksheetHeaderConfig({
  worksheetId,
  defaultTitle,
  defaultInstructions,
  savedHeader,
}: UseWorksheetHeaderConfigArgs) {
  const defaults = useMemo(
    () => ({ title: defaultTitle, instructions: defaultInstructions }),
    [defaultTitle, defaultInstructions]
  )

  const [config, setConfig] = useState<WorksheetHeaderConfig>(() =>
    buildConfigFromSaved(savedHeader, defaults)
  )

  const titleTouchedRef = useRef(Boolean(savedHeader?.title?.trim()))
  const instructionsTouchedRef = useRef(Boolean(savedHeader?.instructions?.trim()))
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestConfigRef = useRef(config)
  const worksheetIdRef = useRef(worksheetId)
  const previousWorksheetIdRef = useRef<string | null>(worksheetId)

  useEffect(() => {
    latestConfigRef.current = config
    worksheetIdRef.current = worksheetId
  }, [config, worksheetId])

  useEffect(() => {
    if (savedHeader != null) {
      titleTouchedRef.current = Boolean(savedHeader.title?.trim())
      instructionsTouchedRef.current = Boolean(savedHeader.instructions?.trim())
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfig((current) => {
        const next = buildConfigFromSaved(savedHeader, defaults)
        if (current.title === next.title && current.instructions === next.instructions && current.fields === next.fields) {
          return current
        }
        return next
      })
      previousWorksheetIdRef.current = worksheetId
      return
    }

    const previousWorksheetId = previousWorksheetIdRef.current
    if (worksheetId === previousWorksheetId) {
      return
    }

    const shouldResetDraft =
      (previousWorksheetId != null && worksheetId == null) ||
      (previousWorksheetId != null &&
        worksheetId != null &&
        worksheetId !== previousWorksheetId)

    if (shouldResetDraft) {
      titleTouchedRef.current = false
      instructionsTouchedRef.current = false
      setConfig((current) => {
        const next = buildConfigFromSaved(null, defaults)
        if (current.title === next.title && current.instructions === next.instructions && current.fields === next.fields) {
          return current
        }
        return next
      })
    }

    previousWorksheetIdRef.current = worksheetId
  }, [savedHeader, worksheetId, defaults])

  useEffect(() => {
    setConfig((current) => {
      const nextTitle = titleTouchedRef.current ? current.title : defaults.title
      const nextInstructions = instructionsTouchedRef.current
        ? current.instructions
        : defaults.instructions

      if (current.title === nextTitle && current.instructions === nextInstructions) {
        return current
      }

      return {
        ...current,
        title: nextTitle,
        instructions: nextInstructions,
      }
    })
  }, [defaults.title, defaults.instructions])

  const resolvedHeader = useMemo(
    () => resolveHeaderConfig(config, defaults),
    [config, defaults]
  )

  const schedulePersist = useCallback(
    (nextConfig: WorksheetHeaderConfig, resolved: ResolvedWorksheetHeader) => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current)
      }

      persistTimeoutRef.current = setTimeout(() => {
        const activeWorksheetId = worksheetIdRef.current
        if (!activeWorksheetId) {
          return
        }

        const persistedHeader = toPersistedHeaderConfig(nextConfig, defaults)

        void import("@/features/worksheet/actions/update-worksheet-header").then(
          ({ updateWorksheetHeaderAction }) =>
            updateWorksheetHeaderAction({
              worksheetId: activeWorksheetId,
              header: persistedHeader,
              resolvedTitle: resolved.title,
            })
        )
      }, PERSIST_DEBOUNCE_MS)
    },
    [defaults]
  )

  const commitConfig = useCallback(
    (updater: (current: WorksheetHeaderConfig) => WorksheetHeaderConfig) => {
      setConfig((current) => {
        const next = updater(current)
        const resolved = resolveHeaderConfig(next, defaults)
        schedulePersist(next, resolved)
        return next
      })
    },
    [defaults, schedulePersist]
  )

  const onTitleChange = useCallback(
    (title: string) => {
      titleTouchedRef.current = true
      commitConfig((current) => ({ ...current, title }))
    },
    [commitConfig]
  )

  const onInstructionsChange = useCallback(
    (instructions: string) => {
      instructionsTouchedRef.current = true
      commitConfig((current) => ({ ...current, instructions }))
    },
    [commitConfig]
  )

  const onFieldsChange = useCallback(
    (fields: WorksheetHeaderFieldToggles) => {
      commitConfig((current) => ({ ...current, fields }))
    },
    [commitConfig]
  )

  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!worksheetId) {
      return
    }

    const resolved = resolveHeaderConfig(latestConfigRef.current, defaults)
    schedulePersist(latestConfigRef.current, resolved)
  }, [worksheetId, defaults, schedulePersist])

  return {
    resolvedHeader,
    onHeaderChange: {
      onTitleChange,
      onInstructionsChange,
      onFieldsChange,
    } satisfies WorksheetHeaderChangeHandlers,
  }
}

function buildConfigFromSaved(
  savedHeader: WorksheetHeaderConfig | null | undefined,
  defaults: { title: string; instructions: string }
): WorksheetHeaderConfig {
  const resolved = resolveHeaderConfig(savedHeader, defaults)

  return {
    title: resolved.title,
    instructions: resolved.instructions,
    fields: mergeHeaderFields(savedHeader?.fields ?? resolved.fields),
  }
}

export { DEFAULT_HEADER_FIELDS }

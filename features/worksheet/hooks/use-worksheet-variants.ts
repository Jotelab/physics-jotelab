"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type {
  WorksheetQuestion,
  WorksheetVariant,
  WorksheetVersionLabel,
} from "@/features/generate/types"
import {
  getAvailableVersionLabels,
  hasUnsavedVariants,
  mergeSavedAndEphemeralVariants,
  mergeVariantQuestions,
} from "@/features/worksheet/utils/merge-variant-questions"

export function useWorksheetVariants(params: {
  masterQuestions: WorksheetQuestion[]
  savedVariants: WorksheetVariant[]
}) {
  const { masterQuestions, savedVariants } = params
  const [activeLabel, setActiveLabel] = useState<WorksheetVersionLabel>("A")
  const [ephemeralVariants, setEphemeralVariants] = useState<WorksheetVariant[]>([])
  const [localSavedVariants, setLocalSavedVariants] = useState(savedVariants)

  useEffect(() => {
    setLocalSavedVariants(savedVariants)
  }, [savedVariants])

  const allVariants = useMemo(
    () => mergeSavedAndEphemeralVariants(localSavedVariants, ephemeralVariants),
    [localSavedVariants, ephemeralVariants]
  )

  const availableLabels = useMemo(
    () => getAvailableVersionLabels(localSavedVariants, ephemeralVariants),
    [localSavedVariants, ephemeralVariants]
  )

  const displayQuestions = useMemo(
    () => mergeVariantQuestions(masterQuestions, activeLabel, allVariants),
    [masterQuestions, activeLabel, allVariants]
  )

  const unsavedVariants = useMemo(
    () => hasUnsavedVariants(localSavedVariants, ephemeralVariants),
    [localSavedVariants, ephemeralVariants]
  )

  const replaceEphemeralVariants = useCallback((variants: WorksheetVariant[]) => {
    setEphemeralVariants(variants)
    if (variants.length > 0) {
      setActiveLabel((current) => (current === "A" ? variants[0]?.label ?? "A" : current))
    }
  }, [])

  const clearEphemeralVariants = useCallback(() => {
    setEphemeralVariants([])
    setActiveLabel("A")
  }, [])

  const markVariantsSaved = useCallback((variants: WorksheetVariant[]) => {
    setEphemeralVariants([])
    setLocalSavedVariants(variants)
  }, [])

  return {
    activeLabel,
    setActiveLabel,
    availableLabels,
    allVariants,
    displayQuestions,
    ephemeralVariants,
    unsavedVariants,
    replaceEphemeralVariants,
    clearEphemeralVariants,
    markVariantsSaved,
  }
}

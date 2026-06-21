"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  getVariantGenerationJobAction,
  saveWorksheetVariantsAction,
  startVariantGenerationJobAction,
} from "@/features/generate/variant-actions"
import type { WorksheetVariant } from "@/features/generate/types"

const POLL_INTERVAL_MS = 1500

export function useVariantGeneration(params: {
  worksheetId: string | null
  questionCount: number
  isWorksheetComplete: boolean
  onCreditBalanceUpdated?: (balance: number) => void
  onVariantsGenerated?: (variants: WorksheetVariant[]) => void
}) {
  const {
    worksheetId,
    questionCount,
    isWorksheetComplete,
    onCreditBalanceUpdated,
    onVariantsGenerated,
  } = params

  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false)
  const [variantProgress, setVariantProgress] = useState<{ current: number; total: number } | null>(
    null
  )
  const [variantStatusMessage, setVariantStatusMessage] = useState<string | null>(null)
  const [variantError, setVariantError] = useState<string | null>(null)
  const [isSavingVariants, setIsSavingVariants] = useState(false)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  useEffect(() => clearPollTimer, [clearPollTimer])

  const pollVariantJob = useCallback(
    async (jobId: string) => {
      const result = await getVariantGenerationJobAction(jobId)

      if (!result.ok) {
        setVariantError(result.message)
        setIsGeneratingVariants(false)
        setVariantProgress(null)
        return
      }

      const poll = result.data

      if (poll.variantProgress) {
        setVariantProgress(poll.variantProgress)
      }

      setVariantStatusMessage(poll.statusMessage)

      if (poll.creditBalance !== null) {
        onCreditBalanceUpdated?.(poll.creditBalance)
      }

      if (poll.isTerminal) {
        setIsGeneratingVariants(false)
        setVariantProgress(null)

        if (poll.variants && poll.variants.length > 0) {
          onVariantsGenerated?.(poll.variants)
        }

        if (poll.status === "failed") {
          setVariantError(poll.statusMessage)
        }

        return
      }

      pollTimerRef.current = setTimeout(() => {
        void pollVariantJob(jobId)
      }, POLL_INTERVAL_MS)
    },
    [onCreditBalanceUpdated, onVariantsGenerated]
  )

  const startVariantGeneration = useCallback(
    async (additionalCount: number) => {
      if (!worksheetId || !isWorksheetComplete) {
        return
      }

      clearPollTimer()
      setVariantError(null)
      setVariantStatusMessage(null)
      setIsGeneratingVariants(true)
      setVariantProgress({ current: 0, total: additionalCount * questionCount })

      const result = await startVariantGenerationJobAction({
        worksheetId,
        additionalCount,
      })

      if (!result.ok) {
        setVariantError(result.message)
        setIsGeneratingVariants(false)
        setVariantProgress(null)
        return
      }

      await pollVariantJob(result.data.jobId)
    },
    [
      worksheetId,
      isWorksheetComplete,
      questionCount,
      clearPollTimer,
      pollVariantJob,
    ]
  )

  const saveVariants = useCallback(
    async (variants: WorksheetVariant[]) => {
      if (!worksheetId || variants.length === 0) {
        return { ok: false as const, message: "Nothing to save." }
      }

      setIsSavingVariants(true)
      setVariantError(null)

      const result = await saveWorksheetVariantsAction({
        worksheetId,
        variants,
      })

      setIsSavingVariants(false)

      if (!result.ok) {
        setVariantError(result.message)
        return result
      }

      return result
    },
    [worksheetId]
  )

  return {
    isGeneratingVariants,
    variantProgress,
    variantStatusMessage,
    variantError,
    isSavingVariants,
    startVariantGeneration,
    saveVariants,
  }
}

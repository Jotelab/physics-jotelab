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
  // Token pattern (same as use-worksheet-generator): a restart bumps the token
  // so an older loop's awaited tick becomes a no-op, and unmount invalidates
  // every loop — no timer refs or self-referencing callbacks to keep in sync.
  const pollTokenRef = useRef(0)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      pollTokenRef.current += 1
    }
  }, [])

  const pollVariantJobUntilTerminal = useCallback(
    async (jobId: string, token: number) => {
      const isCurrent = () => isMountedRef.current && pollTokenRef.current === token

      while (isCurrent()) {
        const result = await getVariantGenerationJobAction(jobId)

        if (!isCurrent()) {
          return
        }

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

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }
    },
    [onCreditBalanceUpdated, onVariantsGenerated]
  )

  const startVariantGeneration = useCallback(
    async (additionalCount: number) => {
      if (!worksheetId || !isWorksheetComplete) {
        return
      }

      const token = ++pollTokenRef.current
      setVariantError(null)
      setVariantStatusMessage(null)
      setIsGeneratingVariants(true)
      setVariantProgress({ current: 0, total: additionalCount * questionCount })

      const result = await startVariantGenerationJobAction({
        worksheetId,
        additionalCount,
      })

      if (!isMountedRef.current || pollTokenRef.current !== token) {
        return
      }

      if (!result.ok) {
        setVariantError(result.message)
        setIsGeneratingVariants(false)
        setVariantProgress(null)
        return
      }

      await pollVariantJobUntilTerminal(result.data.jobId, token)
    },
    [
      worksheetId,
      isWorksheetComplete,
      questionCount,
      pollVariantJobUntilTerminal,
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

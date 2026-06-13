"use client"

import { useMemo, useState } from "react"

import type { SkippedSlot, WorksheetQuestion } from "@/features/generate/types"
import { computeWorksheetCreditLimits } from "@/features/generate/utils/compute-worksheet-credit-limits"
import { getDisplayItems } from "@/features/worksheet/utils"

const isDev = process.env.NODE_ENV === "development"

export type ActiveWorksheetMeta = {
  subjectLabel: string
  lesson: string
  scenario: string
  questionCount: number
}

export function useWorksheetCreditLimits({
  creditBalance,
  questionCount,
  hasRequiredFields,
  isGenerating,
  worksheetId,
  targetQuestionCount,
  questions,
  skippedSlots,
}: {
  creditBalance: number
  questionCount: number
  hasRequiredFields: boolean
  isGenerating: boolean
  worksheetId: string | null
  targetQuestionCount: number | null
  questions: WorksheetQuestion[]
  skippedSlots: SkippedSlot[]
}) {
  const [localCreditBalanceOverride, setLocalCreditBalanceOverride] = useState<number | null>(null)
  const [activeWorksheetMeta, setActiveWorksheetMeta] = useState<ActiveWorksheetMeta | null>(null)
  const [hasGeneratedMock, setHasGeneratedMock] = useState(false)
  const [showAppendInput, setShowAppendInput] = useState(false)
  const [appendCount, setAppendCount] = useState(5)

  const availableCredits = Math.max(0, localCreditBalanceOverride ?? creditBalance)
  const displayItems = getDisplayItems(questions, skippedSlots)
  const worksheetTargetCount =
    targetQuestionCount ?? activeWorksheetMeta?.questionCount ?? null

  const limits = useMemo(
    () =>
      computeWorksheetCreditLimits({
        availableCredits,
        questionCount,
        hasRequiredFields,
        isGenerating,
        worksheetId,
        worksheetTargetCount,
        questionsCount: questions.length,
        displayItemsCount: displayItems.length,
        hasActiveWorksheetMeta: activeWorksheetMeta != null,
        hasGeneratedMock,
        isDev,
      }),
    [
      availableCredits,
      questionCount,
      hasRequiredFields,
      isGenerating,
      worksheetId,
      worksheetTargetCount,
      questions.length,
      displayItems.length,
      activeWorksheetMeta,
      hasGeneratedMock,
    ]
  )

  return {
    availableCredits,
    worksheetTargetCount,
    activeWorksheetMeta,
    setActiveWorksheetMeta,
    setLocalCreditBalanceOverride,
    showAppendInput,
    setShowAppendInput,
    appendCount,
    setAppendCount,
    hasGeneratedMock,
    toggleGeneratedMock: () => setHasGeneratedMock((value) => !value),
    showDevMockToggle: isDev,
    ...limits,
  }
}

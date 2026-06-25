"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useRef, useState } from "react"

import type { WorksheetConfigPanelProps } from "@/features/generate/components/worksheet-config-panel"
import type { WorksheetPreviewPanelProps } from "@/features/generate/components/worksheet-preview-panel"
import { useWorksheetConfigForm } from "@/features/generate/hooks/use-worksheet-config-form"
import { getWorksheetSavedVariantsAction } from "@/features/generate/actions"
import { resolveLessonKey } from "@/features/generate/data/generation-presets"
import { useWorksheetCreditLimits } from "@/features/generate/hooks/use-worksheet-credit-limits"
import { useWorksheetGenerator } from "@/features/generate/hooks/use-worksheet-generator"
import { useWorksheetQuestionActions } from "@/features/generate/hooks/use-worksheet-question-actions"
import type { WorksheetViewMode } from "@/features/worksheet/components/worksheet-preview"
import { useWorksheetHeaderConfig } from "@/features/worksheet/hooks/use-worksheet-header-config"
import type { WorksheetVariant } from "@/features/generate/types"

export function useGenerateWorkspace({ creditBalance }: { creditBalance: number }) {
  const router = useRouter()
  const t = useTranslations("generate")
  const tCommon = useTranslations("common")
  const [viewMode, setViewMode] = useState<WorksheetViewMode>("worksheet")
  const [savedVariants, setSavedVariants] = useState<WorksheetVariant[]>([])
  const configForm = useWorksheetConfigForm()
  const setCreditOverrideRef = useRef<(balance: number) => void>(() => {})
  const savedVariantsEpochRef = useRef(0)

  const {
    isGenerating,
    progress,
    worksheetId,
    targetQuestionCount,
    questions,
    skippedSlots,
    error,
    statusMessage,
    startGeneration,
    appendQuestions,
    replaceQuestion,
    syncTargetQuestionCount,
    resumeActiveJob,
  } = useWorksheetGenerator({
    onCreditBalanceUpdated: (updatedCreditBalance) => {
      setCreditOverrideRef.current(updatedCreditBalance)
    },
  })

  const creditLimits = useWorksheetCreditLimits({
    creditBalance,
    questionCount: configForm.questionCount,
    hasRequiredFields: configForm.hasRequiredFields,
    isGenerating,
    worksheetId,
    targetQuestionCount,
    questions,
    skippedSlots,
  })

  useEffect(() => {
    setCreditOverrideRef.current = creditLimits.setLocalCreditBalanceOverride
  }, [creditLimits.setLocalCreditBalanceOverride])

  const questionActions = useWorksheetQuestionActions({
    worksheetId,
    replaceQuestion,
    onCreditBalanceUpdated: creditLimits.setLocalCreditBalanceOverride,
    onRefresh: () => router.refresh(),
    isGenerating,
  })

  const controlsDisabled = isGenerating

  useEffect(() => {
    if (!worksheetId || isGenerating) {
      return
    }

    void resumeActiveJob(worksheetId)
  }, [worksheetId, isGenerating, resumeActiveJob])

  useEffect(() => {
    if (!worksheetId || !creditLimits.hasGenerated || isGenerating) {
      return
    }

    void syncTargetQuestionCount(worksheetId)
  }, [worksheetId, creditLimits.hasGenerated, isGenerating, syncTargetQuestionCount])

  useEffect(() => {
    if (!worksheetId) {
      savedVariantsEpochRef.current += 1
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedVariants((current) => {
        if (current.length === 0) return current
        return []
      })
      return
    }

    let cancelled = false
    const epochAtFetch = savedVariantsEpochRef.current

    void getWorksheetSavedVariantsAction(worksheetId).then((result) => {
      if (
        cancelled ||
        !result.ok ||
        savedVariantsEpochRef.current !== epochAtFetch
      ) {
        return
      }

      setSavedVariants(result.data.savedVariants)
    })

    return () => {
      cancelled = true
    }
  }, [worksheetId])



  const lessonDisplay = useMemo(() => {
    const trimmed = configForm.trimmedLesson
    if (!trimmed) return ""
    const key = resolveLessonKey(trimmed)
    if (key.isPreset && key.lessonId) {
      return t(`presets.lessons.${key.lessonId}`)
    }
    return trimmed
  }, [configForm.trimmedLesson, t])

  const worksheetTitle = useMemo(() => {
    if (creditLimits.hasActiveWorksheet && creditLimits.activeWorksheetMeta) {
      return `${creditLimits.activeWorksheetMeta.subjectLabel}: ${creditLimits.activeWorksheetMeta.lesson}`
    }
    if (!lessonDisplay) return t("worksheetPreview")
    return `${tCommon("subjects.physics")}: ${lessonDisplay}`
  }, [
    creditLimits.activeWorksheetMeta,
    creditLimits.hasActiveWorksheet,
    lessonDisplay,
    t,
    tCommon,
  ])

  const defaultInstructions = useMemo(() => {
    if (creditLimits.hasActiveWorksheet && creditLimits.activeWorksheetMeta) {
      const countLabel =
        creditLimits.worksheetTargetCount == null
          ? "…"
          : String(creditLimits.worksheetTargetCount)
      return t("questionsSubtitle", {
        count: countLabel,
        scenario: creditLimits.activeWorksheetMeta.scenario,
      })
    }
    if (!configForm.hasRequiredFields) {
      return t("previewHint")
    }
    return t("questionsSubtitle", {
      count: creditLimits.effectiveQuestionCount,
      scenario: configForm.scenarioDescription || "scenario",
    })
  }, [
    creditLimits.activeWorksheetMeta,
    creditLimits.hasActiveWorksheet,
    configForm.hasRequiredFields,
    creditLimits.effectiveQuestionCount,
    configForm.scenarioDescription,
    creditLimits.worksheetTargetCount,
    t,
  ])

  const { resolvedHeader, onHeaderChange } = useWorksheetHeaderConfig({
    worksheetId,
    defaultTitle: worksheetTitle,
    defaultInstructions,
  })

  async function handleGenerate() {
    questionActions.clearActionFeedback()

    const parsed = configForm.buildInput(creditLimits.effectiveQuestionCount)

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      questionActions.setActionError(issue?.message ?? t("validationRequired"))
      return
    }

    creditLimits.setActiveWorksheetMeta({
      subjectLabel: tCommon("subjects.physics"),
      lesson: parsed.data.lesson,
      scenario: parsed.data.scenario,
      questionCount: parsed.data.question_count,
    })

    creditLimits.setShowAppendInput(false)
    await startGeneration(parsed.data)
    router.refresh()
  }

  async function handleAppendQuestions() {
    if (!worksheetId || !creditLimits.canAppend) {
      return
    }

    const count = Math.min(creditLimits.appendCount, creditLimits.maxAppendable)
    if (count < 1) {
      return
    }

    questionActions.clearActionFeedback()
    creditLimits.setShowAppendInput(false)

    const result = await appendQuestions(worksheetId, count, { questions, skippedSlots })

    if (result.ok) {
      if (result.stoppedForCredits) {
        questionActions.setActionMessage(
          t("extendedStoppedCredits", { count: result.newQuestionCount })
        )
      } else {
        questionActions.setActionMessage(t("appendedQuestions", { count }))
      }
    }

    if (result.ok && worksheetId) {
      await syncTargetQuestionCount(worksheetId)
    }

    router.refresh()
  }

  const configPanelProps: WorksheetConfigPanelProps = {
    activeTab: configForm.activeTab,
    onActiveTabChange: configForm.setActiveTab,
    lesson: configForm.lesson,
    resolvedScenarioId: configForm.resolvedScenarioId,
    givenVariableIds: configForm.givenVariableIds,
    findVariableIds: configForm.findVariableIds,
    targetRandomize: configForm.targetRandomize,
    onGivenVariableIdsChange: configForm.setGivenVariableIds,
    onFindVariableIdsChange: configForm.handleFindChange,
    onTargetRandomizeChange: configForm.handleTargetRandomizeChange,
    mathComplexity: configForm.mathComplexity,
    conceptualDifficulty: configForm.conceptualDifficulty,
    onMathComplexityChange: configForm.setMathComplexity,
    onConceptualDifficultyChange: configForm.setConceptualDifficulty,
    controlsDisabled,
    effectiveQuestionCount: creditLimits.effectiveQuestionCount,
    maxQuestionCount: creditLimits.maxQuestionCount,
    availableCredits: creditLimits.availableCredits,
    hasNoCredits: creditLimits.hasNoCredits,
    onLessonChange: configForm.handleLessonChange,
    onLessonSuggestionSelect: configForm.handleLessonSuggestionSelect,
    onScenarioChange: configForm.handleScenarioChange,
    onQuestionCountChange: configForm.setQuestionCount,
    cost: creditLimits.cost,
    hasPartialCredits: creditLimits.hasPartialCredits,
    error,
    actionError: questionActions.actionError,
    statusMessage,
    actionMessage: questionActions.actionMessage,
    hasGenerated: creditLimits.hasGenerated,
    canGenerate: creditLimits.canGenerate,
    canAppend: creditLimits.canAppend,
    isGenerating,
    progress,
    showAppendInput: creditLimits.showAppendInput,
    onToggleAppendInput: () => creditLimits.setShowAppendInput((current) => !current),
    appendCount: creditLimits.appendCount,
    maxAppendable: creditLimits.maxAppendable,
    onAppendCountChange: creditLimits.setAppendCount,
    onGenerate: handleGenerate,
    onAppendQuestions: handleAppendQuestions,
    showDevMockToggle: creditLimits.showDevMockToggle,
    hasGeneratedMock: creditLimits.hasGeneratedMock,
    onToggleGeneratedMock: creditLimits.toggleGeneratedMock,
  }

  const previewPanelProps: WorksheetPreviewPanelProps = {
    worksheetTitle: resolvedHeader.title,
    viewMode,
    onViewModeChange: setViewMode,
    header: resolvedHeader,
    onHeaderChange,
    questions,
    skippedSlots,
    questionActions: questionActions.questionActions,
    worksheetId,
    creditBalance: creditLimits.availableCredits,
    savedVariants,
    isWorksheetComplete:
      creditLimits.hasGenerated &&
      questions.length >= (targetQuestionCount ?? questions.length) &&
      skippedSlots.length === 0 &&
      !isGenerating,
    onCreditBalanceUpdated: creditLimits.setLocalCreditBalanceOverride,
    onVariantsSaved: (variants) => {
      savedVariantsEpochRef.current += 1
      setSavedVariants(variants)
      router.refresh()
    },
    onVariantActionMessage: questionActions.setActionMessage,
    onVariantActionError: questionActions.setActionError,
  }

  return {
    configPanelProps,
    previewPanelProps,
    editDialogProps: questionActions.editDialogProps,
  }
}

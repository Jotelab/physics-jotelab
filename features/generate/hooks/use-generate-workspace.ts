"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useRef, useState } from "react"

import type { WorksheetConfigPanelProps } from "@/features/generate/components/worksheet-config-panel"
import type { WorksheetPreviewPanelProps } from "@/features/generate/components/worksheet-preview-panel"
import { useWorksheetConfigForm } from "@/features/generate/hooks/use-worksheet-config-form"
import { useWorksheetCreditLimits } from "@/features/generate/hooks/use-worksheet-credit-limits"
import { useWorksheetGenerator } from "@/features/generate/hooks/use-worksheet-generator"
import { useWorksheetQuestionActions } from "@/features/generate/hooks/use-worksheet-question-actions"
import { getSubjectLabel } from "@/features/generate/utils/subject-label"
import type { WorksheetViewMode } from "@/features/worksheet/components/worksheet-preview"
import { useWorksheetHeaderConfig } from "@/features/worksheet/hooks/use-worksheet-header-config"

export function useGenerateWorkspace({ creditBalance }: { creditBalance: number }) {
  const router = useRouter()
  const t = useTranslations("generate")
  const tCommon = useTranslations("common")
  const [viewMode, setViewMode] = useState<WorksheetViewMode>("worksheet")
  const configForm = useWorksheetConfigForm()
  const setCreditOverrideRef = useRef<(balance: number) => void>(() => {})

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

  const worksheetTitle = useMemo(() => {
    if (creditLimits.hasActiveWorksheet && creditLimits.activeWorksheetMeta) {
      return `${creditLimits.activeWorksheetMeta.subjectLabel}: ${creditLimits.activeWorksheetMeta.lesson}`
    }
    if (!configForm.subject || !configForm.trimmedLesson) return t("worksheetPreview")
    return `${getSubjectLabel(configForm.subject, tCommon)}: ${configForm.trimmedLesson}`
  }, [
    creditLimits.activeWorksheetMeta,
    creditLimits.hasActiveWorksheet,
    configForm.subject,
    configForm.trimmedLesson,
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
      subjectLabel: getSubjectLabel(parsed.data.subject, tCommon),
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
    subject: configForm.subject,
    lesson: configForm.lesson,
    resolvedScenarioId: configForm.resolvedScenarioId,
    givenVariableIds: configForm.givenVariableIds,
    targetVariableId: configForm.targetVariableId,
    onGivenVariableIdsChange: configForm.setGivenVariableIds,
    onTargetVariableIdChange: configForm.setTargetVariableId,
    controlsDisabled,
    effectiveQuestionCount: creditLimits.effectiveQuestionCount,
    maxQuestionCount: creditLimits.maxQuestionCount,
    availableCredits: creditLimits.availableCredits,
    hasNoCredits: creditLimits.hasNoCredits,
    onSubjectChange: configForm.handleSubjectChange,
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
  }

  return {
    configPanelProps,
    previewPanelProps,
    editDialogProps: questionActions.editDialogProps,
  }
}

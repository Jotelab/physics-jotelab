"use client"

import { FileText } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import type { SkippedSlot, WorksheetQuestion, WorksheetVariant } from "@/features/generate/types"
import type { WorksheetHeaderChangeHandlers } from "@/features/worksheet/hooks/use-worksheet-header-config"
import { useVariantGeneration } from "@/features/worksheet/hooks/use-variant-generation"
import { useWorksheetVariants } from "@/features/worksheet/hooks/use-worksheet-variants"
import { ExportPdfButton } from "@/features/worksheet/components/export-pdf-button"
import { WorksheetPrintAllVariants } from "@/features/worksheet/components/worksheet-print-all-variants"
import { WorksheetVariantToolbar } from "@/features/worksheet/components/worksheet-variant-toolbar"
import {
  WorksheetPreview,
  type WorksheetViewMode,
} from "@/features/worksheet/components/worksheet-preview"
import type { ResolvedWorksheetHeader } from "@/features/worksheet/types/header"
import { SegmentedControl } from "@/components/ui/segmented-control"

type QuestionActions = {
  actionsDisabled: boolean
  busyQuestionId: string | null
  openMenuQuestionId: string | null
  onToggleMenu: (questionId: string) => void
  onEdit: (question: WorksheetQuestion) => void
  onRegenerate: (question: WorksheetQuestion) => void
}

export type WorksheetPreviewPanelProps = {
  worksheetTitle: string
  viewMode: WorksheetViewMode
  onViewModeChange: (mode: WorksheetViewMode) => void
  header: ResolvedWorksheetHeader
  onHeaderChange: WorksheetHeaderChangeHandlers
  questions: WorksheetQuestion[]
  skippedSlots: SkippedSlot[]
  questionActions: QuestionActions
  worksheetId?: string | null
  creditBalance?: number
  savedVariants?: WorksheetVariant[]
  isWorksheetComplete?: boolean
  onCreditBalanceUpdated?: (balance: number) => void
  onVariantsSaved?: (variants: WorksheetVariant[]) => void
  variantActionMessage?: string | null
  onVariantActionMessage?: (message: string | null) => void
  variantActionError?: string | null
  onVariantActionError?: (message: string | null) => void
  onUnsavedVariantsChange?: (unsaved: boolean) => void
  onRequestLeave?: () => void
}

export function WorksheetPreviewPanel({
  worksheetTitle,
  viewMode,
  onViewModeChange,
  header,
  onHeaderChange,
  questions,
  skippedSlots,
  questionActions,
  worksheetId = null,
  creditBalance = 0,
  savedVariants = [],
  isWorksheetComplete = false,
  onCreditBalanceUpdated,
  onVariantsSaved,
  onVariantActionMessage,
  onVariantActionError,
  onUnsavedVariantsChange,
  onRequestLeave,
}: WorksheetPreviewPanelProps) {
  const t = useTranslations("generate")
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false)

  const {
    activeLabel,
    setActiveLabel,
    availableLabels,
    allVariants,
    displayQuestions,
    unsavedVariants,
    replaceEphemeralVariants,
    markVariantsSaved,
    clearEphemeralVariants,
  } = useWorksheetVariants({
    masterQuestions: questions,
    savedVariants,
  })

  useEffect(() => {
    onUnsavedVariantsChange?.(unsavedVariants)
  }, [unsavedVariants, onUnsavedVariantsChange])

  useEffect(() => {
    if (!unsavedVariants) {
      return
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [unsavedVariants])

  const {
    isGeneratingVariants,
    variantProgress,
    variantError,
    isSavingVariants,
    startVariantGeneration,
    saveVariants,
  } = useVariantGeneration({
    worksheetId,
    questionCount: questions.length,
    isWorksheetComplete,
    onCreditBalanceUpdated,
    onVariantsGenerated: replaceEphemeralVariants,
  })

  async function handleSaveVariants() {
    onVariantActionError?.(null)
    onVariantActionMessage?.(null)

    const result = await saveVariants(allVariants)

    if (result.ok) {
      markVariantsSaved(allVariants)
      onVariantActionMessage?.(t("variantsSaved"))
      onVariantsSaved?.(allVariants)
    }
  }

  async function handleGenerateVariants(additionalCount: number) {
    onVariantActionError?.(null)
    onVariantActionMessage?.(null)
    setGenerateDialogOpen(false)
    await startVariantGeneration(additionalCount)
  }

  const canPrintAllVersions = allVariants.length > 0
  const showVariantControls = Boolean(worksheetId && isWorksheetComplete)

  return (
    <section className="flex min-h-[50vh] min-w-0 flex-1 flex-col bg-muted/30 md:min-h-[60vh] lg:min-h-0">
      <div className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3 print:hidden md:px-6">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{worksheetTitle}</span>
          {showVariantControls && activeLabel !== "A" ? (
            <span className="text-xs text-muted-foreground">
              {t("versionLabel", { label: activeLabel })}
            </span>
          ) : null}
        </div>

        {showVariantControls ? (
          <WorksheetVariantToolbar
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            isWorksheetComplete={isWorksheetComplete}
            questionCount={questions.length}
            creditBalance={creditBalance}
            availableVersionLabels={availableLabels}
            activeVersionLabel={activeLabel}
            onVersionLabelChange={setActiveLabel}
            canPrintAllVersions={canPrintAllVersions}
            unsavedVariants={unsavedVariants}
            isGeneratingVariants={isGeneratingVariants}
            variantProgress={variantProgress}
            isSavingVariants={isSavingVariants}
            onGenerateVariants={handleGenerateVariants}
            onSaveVariants={() => void handleSaveVariants()}
            generateDialogOpen={generateDialogOpen}
            onGenerateDialogOpenChange={setGenerateDialogOpen}
            unsavedDialogOpen={unsavedDialogOpen}
            onUnsavedDialogOpenChange={setUnsavedDialogOpen}
            onConfirmLeaveWithoutSaving={() => {
              clearEphemeralVariants()
              setUnsavedDialogOpen(false)
              onRequestLeave?.()
            }}
          />
        ) : (
          <div className="flex items-center gap-2">
            <ExportPdfButton />
            <SegmentedControl
              value={viewMode}
              onValueChange={onViewModeChange}
              options={[
                { value: "worksheet", label: t("worksheet"), id: "view-worksheet-btn" },
                { value: "answer", label: t("answer"), id: "view-answer-btn" },
              ]}
            />
          </div>
        )}
      </div>

      {(variantError || unsavedVariants) && showVariantControls ? (
        <div className="border-b bg-background px-4 py-2 text-sm print:hidden md:px-6">
          {variantError ? <p className="text-destructive">{variantError}</p> : null}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-auto p-4 print:overflow-visible print:bg-white print:p-0 sm:p-6 lg:p-8">
        <div className={canPrintAllVersions ? "print:hidden" : undefined}>
          <WorksheetPreview
            header={header}
            onHeaderChange={onHeaderChange}
            questions={displayQuestions}
            skippedSlots={skippedSlots}
            viewMode={viewMode}
            questionActions={questionActions}
          />
        </div>

        {canPrintAllVersions ? (
          <WorksheetPrintAllVariants
            header={header}
            masterQuestions={questions}
            variants={allVariants}
            viewMode={viewMode}
            skippedSlots={skippedSlots}
          />
        ) : null}
      </div>
    </section>
  )
}

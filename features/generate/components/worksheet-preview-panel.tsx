"use client"

import { FileText } from "lucide-react"
import { useTranslations } from "next-intl"

import { ExportPdfButton } from "@/features/worksheet/components/export-pdf-button"
import {
  WorksheetPreview,
  type WorksheetViewMode,
} from "@/features/worksheet/components/worksheet-preview"
import type { SkippedSlot, WorksheetQuestion } from "@/features/generate/types"
import type { WorksheetHeaderChangeHandlers } from "@/features/worksheet/hooks/use-worksheet-header-config"
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
}: WorksheetPreviewPanelProps) {
  const t = useTranslations("generate")

  return (
    <section className="flex min-h-[50vh] min-w-0 flex-1 flex-col bg-muted/30 md:min-h-[60vh] lg:min-h-0">
      <div className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3 print:hidden md:px-6">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{worksheetTitle}</span>
        </div>
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
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4 print:bg-white print:p-0 sm:p-6 lg:p-8">
        <WorksheetPreview
          header={header}
          onHeaderChange={onHeaderChange}
          questions={questions}
          skippedSlots={skippedSlots}
          viewMode={viewMode}
          questionActions={questionActions}
        />
      </div>
    </section>
  )
}

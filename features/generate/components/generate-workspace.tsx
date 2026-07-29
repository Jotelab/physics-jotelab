"use client"

import dynamic from "next/dynamic"

import { WorksheetConfigPanel } from "@/features/generate/components/worksheet-config-panel"
import { useGenerateWorkspace } from "@/features/generate/hooks/use-generate-workspace"
import { GeneratePreviewSkeleton } from "@/components/loading/generate-preview-skeleton"

const WorksheetPreviewPanel = dynamic(
  () =>
    import("@/features/generate/components/worksheet-preview-panel").then(
      (module) => module.WorksheetPreviewPanel
    ),
  { loading: () => <GeneratePreviewSkeleton />, ssr: false }
)

const EditQuestionDialog = dynamic(
  () =>
    import("@/features/worksheet/components/edit-question-dialog").then(
      (module) => module.EditQuestionDialog
    ),
  { ssr: false }
)

export function GenerateWorkspace({
  creditBalance,
  children,
}: {
  creditBalance: number
  children: React.ReactNode
}) {
  const { configPanelProps, previewPanelProps, editDialogProps } = useGenerateWorkspace({
    creditBalance,
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background lg:flex-row lg:overflow-hidden print:overflow-visible">
      <WorksheetConfigPanel {...configPanelProps} hideHeader header={children} />
      <WorksheetPreviewPanel {...previewPanelProps} />
      {editDialogProps ? <EditQuestionDialog {...editDialogProps} /> : null}
    </div>
  )
}

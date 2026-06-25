"use client"

import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import type { WorksheetVersionLabel } from "@/features/generate/types"
import { ExportPdfButton } from "@/features/worksheet/components/export-pdf-button"
import {
  GenerateVariantsDialog,
  UnsavedVariantsDialog,
} from "@/features/worksheet/components/generate-variants-dialog"
import { PrintAllVariantsButton } from "@/features/worksheet/components/print-all-variants-button"
import type { WorksheetViewMode } from "@/features/worksheet/components/worksheet-preview"

type WorksheetVariantToolbarProps = {
  viewMode: WorksheetViewMode
  onViewModeChange: (mode: WorksheetViewMode) => void
  isWorksheetComplete: boolean
  questionCount: number
  creditBalance: number
  availableVersionLabels: WorksheetVersionLabel[]
  activeVersionLabel: WorksheetVersionLabel
  onVersionLabelChange: (label: WorksheetVersionLabel) => void
  canPrintAllVersions: boolean
  unsavedVariants: boolean
  isGeneratingVariants: boolean
  variantProgress: { current: number; total: number } | null
  isSavingVariants: boolean
  onGenerateVariants: (additionalCount: number) => void
  onSaveVariants: () => void
  generateDialogOpen: boolean
  onGenerateDialogOpenChange: (open: boolean) => void
  unsavedDialogOpen: boolean
  onUnsavedDialogOpenChange: (open: boolean) => void
  onConfirmLeaveWithoutSaving: () => void
}

export function WorksheetVariantToolbar({
  viewMode,
  onViewModeChange,
  isWorksheetComplete,
  questionCount,
  creditBalance,
  availableVersionLabels,
  activeVersionLabel,
  onVersionLabelChange,
  canPrintAllVersions,
  unsavedVariants,
  isGeneratingVariants,
  variantProgress,
  isSavingVariants,
  onGenerateVariants,
  onSaveVariants,
  generateDialogOpen,
  onGenerateDialogOpenChange,
  unsavedDialogOpen,
  onUnsavedDialogOpenChange,
  onConfirmLeaveWithoutSaving,
}: WorksheetVariantToolbarProps) {
  const t = useTranslations("generate")

  const versionOptions = (["A", "B", "C", "D"] as const).map((label) => ({
    value: label,
    label: t("versionLabelShort", { label }),
    disabled: !availableVersionLabels.includes(label),
  }))

  const enabledVersionOptions = versionOptions.filter((option) => !option.disabled)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {isWorksheetComplete ? (
          <Button
            type="button"
            variant="outline"
            size="touch"
            disabled={isGeneratingVariants}
            onClick={() => onGenerateDialogOpenChange(true)}
          >
            {t("generateVariants")}
          </Button>
        ) : null}

        {unsavedVariants ? (
          <Button
            type="button"
            variant="default"
            size="touch"
            disabled={isSavingVariants || isGeneratingVariants}
            onClick={onSaveVariants}
          >
            {isSavingVariants ? t("savingVariants") : t("saveVariants")}
          </Button>
        ) : null}

        {canPrintAllVersions ? <PrintAllVariantsButton /> : <ExportPdfButton />}

        {enabledVersionOptions.length > 1 ? (
          <SegmentedControl
            value={activeVersionLabel}
            onValueChange={onVersionLabelChange}
            options={enabledVersionOptions.map(({ value, label }) => ({ value, label }))}
            className={
              enabledVersionOptions.length > 2 ? "grid-cols-4 lg:grid-cols-4" : undefined
            }
          />
        ) : null}

        <SegmentedControl
          value={viewMode}
          onValueChange={onViewModeChange}
          options={[
            { value: "worksheet", label: t("worksheet"), id: "view-worksheet-btn" },
            { value: "answer", label: t("answer"), id: "view-answer-btn" },
          ]}
        />
      </div>

      {isGeneratingVariants && variantProgress ? (
        <p className="w-full text-sm text-muted-foreground print:hidden">
          {t("generatingVariantsProgress", {
            current: variantProgress.current,
            total: variantProgress.total,
          })}
        </p>
      ) : null}

      <GenerateVariantsDialog
        open={generateDialogOpen}
        onOpenChange={onGenerateDialogOpenChange}
        questionCount={questionCount}
        creditBalance={creditBalance}
        isSubmitting={isGeneratingVariants}
        onConfirm={onGenerateVariants}
      />

      <UnsavedVariantsDialog
        open={unsavedDialogOpen}
        onOpenChange={onUnsavedDialogOpenChange}
        onConfirmLeave={onConfirmLeaveWithoutSaving}
      />
    </>
  )
}

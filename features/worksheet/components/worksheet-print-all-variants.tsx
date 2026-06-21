"use client"

import { useTranslations } from "next-intl"

import type { SkippedSlot, WorksheetQuestion } from "@/features/generate/types"
import type { WorksheetVersionLabel } from "@/features/generate/types"
import { WorksheetPreview, type WorksheetViewMode } from "@/features/worksheet/components/worksheet-preview"
import type { WorksheetHeaderChangeHandlers } from "@/features/worksheet/hooks/use-worksheet-header-config"
import type { ResolvedWorksheetHeader } from "@/features/worksheet/types/header"
import { mergeVariantQuestions } from "@/features/worksheet/utils/merge-variant-questions"
import type { WorksheetVariant } from "@/features/generate/types"

type WorksheetPrintAllVariantsProps = {
  header: ResolvedWorksheetHeader
  masterQuestions: WorksheetQuestion[]
  variants: WorksheetVariant[]
  viewMode: WorksheetViewMode
  skippedSlots?: SkippedSlot[]
}

export function WorksheetPrintAllVariants({
  header,
  masterQuestions,
  variants,
  viewMode,
  skippedSlots = [],
}: WorksheetPrintAllVariantsProps) {
  const t = useTranslations("generate")

  const versionLabels: WorksheetVersionLabel[] = [
    "A",
    ...variants.map((variant) => variant.label),
  ]

  return (
    <div className="hidden print:block">
      {versionLabels.map((label, index) => {
        const questions =
          label === "A"
            ? masterQuestions
            : mergeVariantQuestions(masterQuestions, label, variants)

        const versionHeader = {
          ...header,
          title: `${header.title} — ${t("versionLabel", { label })}`,
        }

        return (
          <div
            key={label}
            className={index < versionLabels.length - 1 ? "break-after-page" : undefined}
          >
            <WorksheetPreview
              header={versionHeader}
              questions={questions}
              skippedSlots={skippedSlots}
              viewMode={viewMode}
            />
          </div>
        )
      })}
    </div>
  )
}

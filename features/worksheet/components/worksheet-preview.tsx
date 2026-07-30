"use client"

import "katex/dist/katex.min.css"

import { MoreVertical } from "lucide-react"
import { useTranslations } from "next-intl"
import { BlockMath, InlineMath } from "react-katex"

import { PendulumDoodle } from "@/components/doodles"
import { Button } from "@/components/ui/button"
import type { SkippedSlot, WorksheetQuestion } from "@/features/generate/types"
import { TikzDiagram } from "@/features/worksheet/components/tikz-diagram"
import { WorksheetEditableHeader } from "@/features/worksheet/components/worksheet-editable-header"
import type { WorksheetHeaderChangeHandlers } from "@/features/worksheet/hooks/use-worksheet-header-config"
import { useWorksheetPagination } from "@/features/worksheet/hooks/use-worksheet-pagination"
import type { ResolvedWorksheetHeader } from "@/features/worksheet/types/header"
import {
  parseMathTextSegments,
  renderMathTextSegments,
} from "@/features/worksheet/parse-math-text"
import { type DisplayItem, type WorksheetViewMode, getDisplayItems } from "@/features/worksheet/utils"
import { cn } from "@/lib/utils"

export type { DisplayItem, WorksheetViewMode }

type WorksheetQuestionActions = {
  actionsDisabled: boolean
  busyQuestionId: string | null
  openMenuQuestionId: string | null
  onToggleMenu: (questionId: string) => void
  onEdit: (question: WorksheetQuestion) => void
  onRegenerate: (question: WorksheetQuestion) => void
}

const worksheetPageBaseClassName = cn(
  "worksheet-page box-border flex w-[210mm] flex-col bg-white text-foreground dark:bg-card",
  "px-[18mm] py-[16mm]",
  "shadow-sm ring-1 ring-border",
  "print:m-0 print:h-[297mm] print:bg-white print:text-black print:shadow-none print:ring-0"
)

const worksheetContentWidthClassName = "w-full max-w-[174mm]"

const measureLayerClassName = cn(
  "pointer-events-none absolute left-0 top-0 w-[174mm]",
  "invisible"
)

export function MathText({ children }: { children: string }) {
  const segments = parseMathTextSegments(children)
  const nodes = renderMathTextSegments(segments, {
    renderText: (content) => content,
    renderInline: (math, key) => <InlineMath key={key} math={math} />,
    renderBlock: (math, key) => <BlockMath key={key} math={math} />,
  })

  return <>{nodes}</>
}

function formatGivenValue(value: WorksheetQuestion["given_values"][number]) {
  const unit = value.unit ? ` ${value.unit}` : ""
  return `${value.symbol}: ${value.label} = ${String(value.value)}${unit}`
}

export { getDisplayItems }

export function WorksheetPreview({
  header,
  onHeaderChange,
  questions,
  skippedSlots = [],
  viewMode,
  emptyMessage,
  questionActions,
}: {
  header: ResolvedWorksheetHeader
  onHeaderChange?: WorksheetHeaderChangeHandlers
  questions: WorksheetQuestion[]
  skippedSlots?: SkippedSlot[]
  viewMode: WorksheetViewMode
  emptyMessage?: string
  questionActions?: WorksheetQuestionActions
}) {
  const t = useTranslations("generate")
  const resolvedEmptyMessage = emptyMessage ?? t("emptyPreview")
  const displayItems = getDisplayItems(questions, skippedSlots)

  const {
    measureItemsRef,
    headerMeasureRef,
    setItemMeasureRef,
    isHeaderDirty,
    isItemDirty,
    pageItemIndices,
    overflowPageIndices,
    measureContentWidthStyle,
  } = useWorksheetPagination(
    displayItems,
    viewMode,
    header.title,
    header.instructions,
    header.fields
  )

  const overflowPageSet = new Set(overflowPageIndices)

  if (displayItems.length === 0) {
    return (
      <div className="worksheet-document mx-auto flex w-full max-w-[210mm] flex-col items-center gap-6 print:gap-0">
        <div className={cn(worksheetPageBaseClassName, "h-[297mm]")}>
          <WorksheetEditableHeader
            header={header}
            viewMode={viewMode}
            editable={Boolean(onHeaderChange)}
            onHeaderChange={onHeaderChange}
          />
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <div className="flex min-h-72 w-full flex-col items-center justify-center gap-4 rounded-md border border-dashed bg-muted/10 p-8 text-center text-sm text-muted-foreground">
              <span className="print:hidden">
                <PendulumDoodle />
              </span>
              {resolvedEmptyMessage}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="worksheet-document relative mx-auto flex w-full max-w-[210mm] flex-col items-center gap-6 print:gap-0">
      <div className="relative h-0 overflow-hidden print:hidden" aria-hidden>
      <div
        ref={measureItemsRef}
        className={measureLayerClassName}
        style={measureContentWidthStyle}
      >
        {isHeaderDirty ? (
          <div ref={headerMeasureRef}>
            <WorksheetEditableHeader
            header={header}
            viewMode={viewMode}
            editable={Boolean(onHeaderChange)}
            onHeaderChange={onHeaderChange}
          />
          </div>
        ) : null}
        <div className="space-y-8">
          {displayItems.map((item, index) => {
            if (!isItemDirty(index)) {
              return null
            }

            return (
              <div
                key={getDisplayItemKey(item)}
                ref={(element) => setItemMeasureRef(index, element)}
              >
                <DisplayItemBlock
                  item={item}
                  viewMode={viewMode}
                  questionActions={questionActions}
                />
              </div>
            )
          })}
        </div>
      </div>
      </div>

      {pageItemIndices === null ? (
        <div
          className={cn(worksheetPageBaseClassName, "h-[297mm] animate-pulse")}
          aria-busy="true"
          aria-label={t("layingOutPages")}
        />
      ) : (
        <div data-testid="worksheet-pages" className="contents">
          {pageItemIndices.map((itemIndices, pageIndex) => (
            <div
              key={`page-${pageIndex}`}
              className={cn(
                worksheetPageBaseClassName,
                overflowPageSet.has(pageIndex)
                  ? "min-h-[297mm] h-auto"
                  : "h-[297mm]"
              )}
            >
              {pageIndex === 0 ? (
                <WorksheetEditableHeader
            header={header}
            viewMode={viewMode}
            editable={Boolean(onHeaderChange)}
            onHeaderChange={onHeaderChange}
          />
              ) : null}
              <div
                className={cn(
                  "min-h-0 flex-1 space-y-8",
                  overflowPageSet.has(pageIndex) ? "overflow-visible" : "overflow-hidden",
                  worksheetContentWidthClassName
                )}
              >
                {itemIndices.map((itemIndex) => {
                  const item = displayItems[itemIndex]
                  if (!item) {
                    return null
                  }

                  return (
                    <DisplayItemBlock
                      key={getDisplayItemKey(item)}
                      item={item}
                      viewMode={viewMode}
                      questionActions={questionActions}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getDisplayItemKey(item: DisplayItem) {
  return item.type === "question" ? item.question.id : `skipped-${item.order}`
}

function DisplayItemBlock({
  item,
  viewMode,
  questionActions,
}: {
  item: DisplayItem
  viewMode: WorksheetViewMode
  questionActions?: WorksheetQuestionActions
}) {
  if (item.type === "skipped") {
    return <SkippedQuestionBlock skipped={item.skipped} />
  }

  return (
    <QuestionBlock
      question={item.question}
      viewMode={viewMode}
      questionActions={questionActions}
    />
  )
}

function SkippedQuestionBlock({ skipped }: { skipped: SkippedSlot }) {
  return (
    <article className="break-inside-avoid rounded-md border border-dashed border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium">
          {skipped.order}
        </div>
        <p className="text-sm text-destructive">{skipped.message}</p>
      </div>
    </article>
  )
}

function QuestionBlock({
  question,
  viewMode,
  questionActions,
}: {
  question: WorksheetQuestion
  viewMode: WorksheetViewMode
  questionActions?: WorksheetQuestionActions
}) {
  const t = useTranslations("generate")
  const isBusy = questionActions?.busyQuestionId === question.id
  const isMenuOpen = questionActions?.openMenuQuestionId === question.id

  return (
    <article className="group relative break-inside-avoid">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium">
          {question.order}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-6">
            <MathText>{question.question_text}</MathText>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            {question.given_values.map((value) => (
              <div key={`${question.id}-${value.symbol}-${value.label}`}>
                <MathText>{formatGivenValue(value)}</MathText>
              </div>
            ))}
            <div>
              {t("target")} <MathText>{question.target_variable.label}</MathText>
              {question.target_variable.unit ? ` (${question.target_variable.unit})` : ""}
            </div>
          </div>
        </div>
        {questionActions ? (
          <div className="relative print:hidden">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t("questionActions", { order: question.order })}
              disabled={questionActions.actionsDisabled}
              onClick={() => questionActions.onToggleMenu(question.id)}
            >
              <MoreVertical className="size-4" />
            </Button>
            {isMenuOpen ? (
              <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border bg-background p-1 text-sm shadow-sm">
                <button
                  type="button"
                  className="block w-full rounded px-3 py-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={questionActions.actionsDisabled}
                  onClick={() => questionActions.onEdit(question)}
                >
                  {t("editFree")}
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-3 py-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={questionActions.actionsDisabled}
                  onClick={() => questionActions.onRegenerate(question)}
                >
                  {t("regenerateCredit")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isBusy ? (
        <p className="ml-10 mb-3 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground print:hidden">
          {t("updatingQuestion")}
        </p>
      ) : null}

      {question.diagram_svg ? (
        <TikzDiagram
          svg={question.diagram_svg}
          label={t("diagramLabel", { order: question.order })}
          className="ml-10 mb-3"
        />
      ) : null}

      {viewMode === "worksheet" ? (
        <div className="ml-10 h-28 rounded-md border border-dashed bg-muted/10" />
      ) : (
        <div className="ml-10 rounded-md border bg-muted/20 p-4 text-sm leading-6">
          <p className="font-medium">{t("solution")}</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-muted-foreground">
            {question.solution.steps.map((step, index) => (
              <li key={`${question.id}-step-${index}`}>
                <MathText>{step}</MathText>
              </li>
            ))}
          </ol>
          <div className="mt-3 font-medium">
            {t("finalAnswer")} <MathText>{question.solution.final_answer}</MathText>
          </div>
        </div>
      )}
    </article>
  )
}

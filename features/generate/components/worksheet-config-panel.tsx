"use client"

import type { ReactNode } from "react"
import { GraduationCap, PlusCircle, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"

import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { formLabelClass } from "@/lib/ui-classes"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LessonCombobox } from "@/features/generate/components/lesson-combobox"
import { ScenarioSelect } from "@/features/generate/components/scenario-select"
import { SubjectSelector } from "@/features/generate/components/subject-selector"
import { VariableCheckboxPicker } from "@/features/generate/components/variable-checkbox-picker"
import { MAX_INITIAL_WORKSHEET_QUESTION_COUNT } from "@/features/generate/limits"
import type { GenerationProgress, Subject } from "@/features/generate/types"

export type WorksheetConfigPanelProps = {
  activeTab: "basic" | "advanced"
  onActiveTabChange: (tab: "basic" | "advanced") => void
  subject: Subject | ""
  lesson: string
  resolvedScenarioId: string
  givenVariableIds: string[]
  targetVariableId: string
  onGivenVariableIdsChange: (ids: string[]) => void
  onTargetVariableIdChange: (id: string) => void
  controlsDisabled: boolean
  effectiveQuestionCount: number
  maxQuestionCount: number
  availableCredits: number
  hasNoCredits: boolean
  onSubjectChange: (subject: Subject) => void
  onLessonChange: (lesson: string) => void
  onLessonSuggestionSelect: () => void
  onScenarioChange: (id: string, description: string) => void
  onQuestionCountChange: (count: number) => void
  cost: number
  hasPartialCredits: boolean
  error: string | null
  actionError: string | null
  statusMessage: string | null
  actionMessage: string | null
  hasGenerated: boolean
  canGenerate: boolean
  canAppend: boolean
  isGenerating: boolean
  progress: GenerationProgress | null
  showAppendInput: boolean
  onToggleAppendInput: () => void
  appendCount: number
  maxAppendable: number
  onAppendCountChange: (count: number) => void
  onGenerate: () => void
  onAppendQuestions: () => void
  showDevMockToggle: boolean
  hasGeneratedMock: boolean
  onToggleGeneratedMock: () => void
}

function WorksheetBasicFields({
  subject,
  lesson,
  resolvedScenarioId,
  controlsDisabled,
  effectiveQuestionCount,
  maxQuestionCount,
  availableCredits,
  hasNoCredits,
  onSubjectChange,
  onLessonChange,
  onLessonSuggestionSelect,
  onScenarioChange,
  onQuestionCountChange,
}: Pick<
  WorksheetConfigPanelProps,
  | "subject"
  | "lesson"
  | "resolvedScenarioId"
  | "controlsDisabled"
  | "effectiveQuestionCount"
  | "maxQuestionCount"
  | "availableCredits"
  | "hasNoCredits"
  | "onSubjectChange"
  | "onLessonChange"
  | "onLessonSuggestionSelect"
  | "onScenarioChange"
  | "onQuestionCountChange"
>) {
  const t = useTranslations("generate")

  return (
    <div className="space-y-6">
      <SubjectSelector value={subject} onChange={onSubjectChange} disabled={controlsDisabled} />

      <LessonCombobox
        subject={subject}
        value={lesson}
        onChange={onLessonChange}
        onSuggestionSelect={onLessonSuggestionSelect}
        disabled={controlsDisabled}
      />

      <ScenarioSelect
        subject={subject}
        lesson={lesson}
        value={resolvedScenarioId}
        onChange={onScenarioChange}
        disabled={controlsDisabled}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="question-count" className={formLabelClass}>
            {t("questions")}
          </label>
          <output
            htmlFor="question-count"
            className="rounded-lg border px-3 py-1.5 text-lg font-medium tabular-nums lg:rounded-md lg:px-2.5 lg:py-1.5 lg:text-base"
          >
            {effectiveQuestionCount}
          </output>
        </div>
        <Slider
          id="question-count"
          min={1}
          max={maxQuestionCount}
          step={1}
          value={[effectiveQuestionCount]}
          disabled={controlsDisabled || hasNoCredits}
          onValueChange={([val]) => {
            if (val != null) onQuestionCountChange(val)
          }}
          aria-label={t("numberOfQuestions")}
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>1</span>
          <span>{maxQuestionCount}</span>
        </div>
        {availableCredits < MAX_INITIAL_WORKSHEET_QUESTION_COUNT ? (
          <p className="text-xs text-muted-foreground">
            {t("limitedQuestions", { count: maxQuestionCount })}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function WorksheetGenerationActions({
  availableCredits,
  cost,
  hasNoCredits,
  hasPartialCredits,
  error,
  actionError,
  statusMessage,
  actionMessage,
  hasGenerated,
  canGenerate,
  canAppend,
  isGenerating,
  progress,
  showAppendInput,
  onToggleAppendInput,
  appendCount,
  maxAppendable,
  onAppendCountChange,
  onGenerate,
  onAppendQuestions,
  showDevMockToggle,
  onToggleGeneratedMock,
}: Pick<
  WorksheetConfigPanelProps,
  | "availableCredits"
  | "cost"
  | "hasNoCredits"
  | "hasPartialCredits"
  | "error"
  | "actionError"
  | "statusMessage"
  | "actionMessage"
  | "hasGenerated"
  | "canGenerate"
  | "canAppend"
  | "isGenerating"
  | "progress"
  | "showAppendInput"
  | "onToggleAppendInput"
  | "appendCount"
  | "maxAppendable"
  | "onAppendCountChange"
  | "onGenerate"
  | "onAppendQuestions"
  | "showDevMockToggle"
  | "onToggleGeneratedMock"
>) {
  const t = useTranslations("generate")

  return (
    <div className="space-y-3 border-t pt-5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("availableCredits")}</span>
        <span className="font-medium tabular-nums">{availableCredits}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("costPreview")}</span>
        <span className="font-medium tabular-nums">{t("creditsUnit", { count: cost })}</span>
      </div>

      <div className="space-y-2">
        {hasNoCredits ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {t("needOneCredit")}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        {actionError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {actionError}
          </p>
        ) : null}

        <div aria-live="polite" aria-atomic="true" className="space-y-2">
          {hasPartialCredits ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {t("partialCredits", { count: availableCredits })}
            </p>
          ) : null}
          {statusMessage ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {statusMessage}
            </p>
          ) : null}
          {actionMessage ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {actionMessage}
            </p>
          ) : null}
          {isGenerating && progress && !hasGenerated ? (
            <p className="sr-only">
              {t("generatingProgress", { current: progress.current, total: progress.total })}
            </p>
          ) : null}
        </div>
      </div>

      {!hasGenerated ? (
        <Button
          id="generate-worksheet-btn"
          type="button"
          size="touch-wide"
          disabled={!canGenerate}
          onClick={onGenerate}
        >
          {isGenerating && progress
            ? t("generatingProgressShort", { current: progress.current, total: progress.total })
            : t("generateWorksheet", { cost })}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          {isGenerating && progress ? (
            <p
              aria-live="polite"
              aria-atomic="true"
              className="rounded-md border bg-muted/40 px-3 py-2 text-center text-sm text-muted-foreground"
            >
              {t("generatingProgressShort", { current: progress.current, total: progress.total })}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              id="regenerate-all-btn"
              type="button"
              variant="outline"
              size="touch-wide"
              className="flex-1"
              disabled={!canGenerate}
              onClick={onGenerate}
              aria-label={t("regenerateAllAria")}
            >
              <RefreshCw className="size-4" />
              {t("regenerateAll")}
            </Button>
            <Button
              id="append-questions-btn"
              type="button"
              size="touch-wide"
              className="flex-1"
              disabled={!canAppend}
              onClick={onToggleAppendInput}
              aria-label={t("appendQuestionsAria")}
              aria-expanded={showAppendInput}
            >
              <PlusCircle className="size-4" />
              {t("appendQuestions")}
            </Button>
          </div>

          {showAppendInput ? (
            <div className="space-y-2 rounded-md border bg-muted/40 p-3">
              <label htmlFor="append-count" className="text-sm font-medium">
                {t("appendCountLabel", { max: maxAppendable })}
              </label>
              <div className="flex gap-2">
                <input
                  id="append-count"
                  type="number"
                  min={1}
                  max={maxAppendable}
                  value={Math.min(appendCount, maxAppendable)}
                  disabled={isGenerating}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    if (Number.isFinite(next)) {
                      onAppendCountChange(next)
                    }
                  }}
                  className="h-10 w-24 rounded-md border bg-background px-3 text-sm"
                  aria-label={t("appendCountAria")}
                />
                <Button
                  type="button"
                  className="flex-1"
                  disabled={!canAppend || isGenerating}
                  onClick={onAppendQuestions}
                >
                  {t("confirmAppend")}
                </Button>
              </div>
            </div>
          ) : null}

          {showDevMockToggle ? (
            <button
              type="button"
              onClick={onToggleGeneratedMock}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {t("devToggle")}
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function WorksheetConfigPanel({
  hideHeader = false,
  header,
  ...props
}: WorksheetConfigPanelProps & {
  hideHeader?: boolean
  header?: ReactNode
}) {
  const t = useTranslations("generate")
  const tCommon = useTranslations("common")

  const basicFields = (
    <WorksheetBasicFields
      subject={props.subject}
      lesson={props.lesson}
      resolvedScenarioId={props.resolvedScenarioId}
      controlsDisabled={props.controlsDisabled}
      effectiveQuestionCount={props.effectiveQuestionCount}
      maxQuestionCount={props.maxQuestionCount}
      availableCredits={props.availableCredits}
      hasNoCredits={props.hasNoCredits}
      onSubjectChange={props.onSubjectChange}
      onLessonChange={props.onLessonChange}
      onLessonSuggestionSelect={props.onLessonSuggestionSelect}
      onScenarioChange={props.onScenarioChange}
      onQuestionCountChange={props.onQuestionCountChange}
    />
  )

  const actionArea = <WorksheetGenerationActions {...props} />

  return (
    <section className="w-full shrink-0 border-b bg-background p-4 print:hidden md:p-6 lg:w-[340px] lg:overflow-y-auto lg:border-r lg:border-b-0 xl:w-[400px] 2xl:w-[360px]">
      {header}
      {!hideHeader ? (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <GraduationCap className="size-4" />
            {tCommon("generate")}
          </div>
          <PageHeader title={t("configureWorksheet")} className="mb-0" />
        </div>
      ) : null}

      <Tabs
        value={props.activeTab}
        onValueChange={(value) => props.onActiveTabChange(value as "basic" | "advanced")}
      >
        <TabsList className="mb-5 h-16 w-full gap-1 p-2 lg:h-12 lg:gap-1 lg:p-1">
          <TabsTrigger
            value="basic"
            className="min-h-12 flex-1 rounded-lg text-lg lg:min-h-0 lg:h-10 lg:rounded-md lg:text-base"
            id="tab-basic"
          >
            {t("basic")}
          </TabsTrigger>
          <TabsTrigger
            value="advanced"
            className="min-h-12 flex-1 rounded-lg text-lg lg:min-h-0 lg:h-10 lg:rounded-md lg:text-base"
            id="tab-advanced"
          >
            {t("advanced")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <div className="space-y-7">
            {basicFields}
            {actionArea}
          </div>
        </TabsContent>

        <TabsContent value="advanced">
          <div className="space-y-7">
            {basicFields}

            <VariableCheckboxPicker
              subject={props.subject}
              givenVariableIds={props.givenVariableIds}
              targetVariableId={props.targetVariableId}
              onGivenChange={props.onGivenVariableIdsChange}
              onTargetChange={props.onTargetVariableIdChange}
              disabled={props.controlsDisabled}
            />

            <p className="text-xs text-muted-foreground">{t("variablesHint")}</p>

            {actionArea}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  )
}

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
import {
  ConceptualDifficultySelect,
  MathComplexitySelect,
} from "@/features/generate/components/difficulty-select"
import { ScenarioSelect } from "@/features/generate/components/scenario-select"
import { VariableConstraintPicker } from "@/features/generate/components/variable-constraint-picker"
import { MAX_INITIAL_WORKSHEET_QUESTION_COUNT } from "@/features/generate/limits"
import type { ConceptualDifficulty, GenerationProgress, MathComplexity } from "@/features/generate/types"

/** Worksheet config form state + handlers, plus whether controls are disabled. */
export type WorksheetFormControls = {
  activeTab: "basic" | "advanced"
  onActiveTabChange: (tab: "basic" | "advanced") => void
  controlsDisabled: boolean
  lesson: string
  resolvedScenarioId: string
  onLessonChange: (lesson: string) => void
  onLessonSuggestionSelect: () => void
  onScenarioChange: (id: string, description: string) => void
  mathComplexity: MathComplexity
  conceptualDifficulty: ConceptualDifficulty
  onMathComplexityChange: (value: MathComplexity) => void
  onConceptualDifficultyChange: (value: ConceptualDifficulty) => void
  onQuestionCountChange: (count: number) => void
  givenVariableIds: string[]
  findVariableIds: string[]
  targetRandomize: boolean
  onGivenVariableIdsChange: (ids: string[]) => void
  onFindVariableIdsChange: (ids: string[]) => void
  onTargetRandomizeChange: (enabled: boolean) => void
}

/**
 * Credit economics for the *initial* generation: what it will cost, what the
 * user has, and whether that is enough to proceed.
 */
export type WorksheetCreditState = {
  effectiveQuestionCount: number
  maxQuestionCount: number
  availableCredits: number
  hasNoCredits: boolean
  cost: number
  hasPartialCredits: boolean
  hasGenerated: boolean
  canGenerate: boolean
}

/** The "add more questions to an existing worksheet" control and its state. */
export type WorksheetAppendControls = {
  canAppend: boolean
  showAppendInput: boolean
  onToggleAppendInput: () => void
  appendCount: number
  maxAppendable: number
  onAppendCountChange: (count: number) => void
}

/**
 * Development-only affordances; `showDevMockToggle` is false in production.
 *
 * The mock's own on/off state stays inside `useWorksheetCreditLimits` — it
 * feeds `hasGenerated` there and the toggle button renders the same either
 * way, so the panel has no use for it.
 */
export type WorksheetDevTools = {
  showDevMockToggle: boolean
  onToggleGeneratedMock: () => void
}

/** Generation progress and the error/status feedback strings. */
export type WorksheetGenerationStatus = {
  error: string | null
  actionError: string | null
  statusMessage: string | null
  actionMessage: string | null
  isGenerating: boolean
  progress: GenerationProgress | null
}

export type WorksheetConfigPanelProps = {
  form: WorksheetFormControls
  credits: WorksheetCreditState
  append: WorksheetAppendControls
  devTools: WorksheetDevTools
  status: WorksheetGenerationStatus
  onGenerate: () => void
  onAppendQuestions: () => void
}

function WorksheetBasicFields({
  form,
  credits,
}: {
  form: WorksheetFormControls
  credits: WorksheetCreditState
}) {
  const t = useTranslations("generate")

  return (
    <div className="space-y-6">
      <LessonCombobox
        value={form.lesson}
        onChange={form.onLessonChange}
        onSuggestionSelect={form.onLessonSuggestionSelect}
        disabled={form.controlsDisabled}
      />

      <ScenarioSelect
        lesson={form.lesson}
        value={form.resolvedScenarioId}
        onChange={form.onScenarioChange}
        disabled={form.controlsDisabled}
      />

      <MathComplexitySelect
        value={form.mathComplexity}
        onChange={form.onMathComplexityChange}
        disabled={form.controlsDisabled}
      />

      <ConceptualDifficultySelect
        value={form.conceptualDifficulty}
        onChange={form.onConceptualDifficultyChange}
        disabled={form.controlsDisabled}
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
            {credits.effectiveQuestionCount}
          </output>
        </div>
        <Slider
          id="question-count"
          min={1}
          max={credits.maxQuestionCount}
          step={1}
          value={[credits.effectiveQuestionCount]}
          disabled={form.controlsDisabled || credits.hasNoCredits}
          onValueChange={([val]) => {
            if (val != null) form.onQuestionCountChange(val)
          }}
          aria-label={t("numberOfQuestions")}
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>1</span>
          <span>{credits.maxQuestionCount}</span>
        </div>
        {credits.availableCredits < MAX_INITIAL_WORKSHEET_QUESTION_COUNT ? (
          <p className="text-xs text-muted-foreground">
            {t("limitedQuestions", { count: credits.maxQuestionCount })}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function WorksheetGenerationActions({
  credits,
  append,
  devTools,
  status,
  onGenerate,
  onAppendQuestions,
}: {
  credits: WorksheetCreditState
  append: WorksheetAppendControls
  devTools: WorksheetDevTools
  status: WorksheetGenerationStatus
  onGenerate: () => void
  onAppendQuestions: () => void
}) {
  const t = useTranslations("generate")

  return (
    <div className="space-y-3 border-t pt-5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("availableCredits")}</span>
        <span className="font-medium tabular-nums">{credits.availableCredits}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("costPreview")}</span>
        <span className="font-medium tabular-nums">{t("creditsUnit", { count: credits.cost })}</span>
      </div>

      <div className="space-y-2">
        {credits.hasNoCredits ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {t("needOneCredit")}
          </p>
        ) : null}
        {status.error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {status.error}
          </p>
        ) : null}
        {status.actionError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {status.actionError}
          </p>
        ) : null}

        <div aria-live="polite" aria-atomic="true" className="space-y-2">
          {credits.hasPartialCredits ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {t("partialCredits", { count: credits.availableCredits })}
            </p>
          ) : null}
          {status.statusMessage ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {status.statusMessage}
            </p>
          ) : null}
          {status.actionMessage ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {status.actionMessage}
            </p>
          ) : null}
          {status.isGenerating && status.progress && !credits.hasGenerated ? (
            <p className="sr-only">
              {t("generatingProgress", { current: status.progress.current, total: status.progress.total })}
            </p>
          ) : null}
        </div>
      </div>

      {!credits.hasGenerated ? (
        <Button
          id="generate-worksheet-btn"
          type="button"
          size="touch-wide"
          disabled={!credits.canGenerate}
          onClick={onGenerate}
        >
          {status.isGenerating && status.progress
            ? t("generatingProgressShort", { current: status.progress.current, total: status.progress.total })
            : t("generateWorksheet", { cost: credits.cost })}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          {status.isGenerating && status.progress ? (
            <p
              aria-live="polite"
              aria-atomic="true"
              className="rounded-md border bg-muted/40 px-3 py-2 text-center text-sm text-muted-foreground"
            >
              {t("generatingProgressShort", { current: status.progress.current, total: status.progress.total })}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              id="regenerate-all-btn"
              type="button"
              variant="outline"
              size="touch-wide"
              className="flex-1"
              disabled={!credits.canGenerate}
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
              disabled={!append.canAppend}
              onClick={append.onToggleAppendInput}
              aria-label={t("appendQuestionsAria")}
              aria-expanded={append.showAppendInput}
            >
              <PlusCircle className="size-4" />
              {t("appendQuestions")}
            </Button>
          </div>

          {append.showAppendInput ? (
            <div className="space-y-2 rounded-md border bg-muted/40 p-3">
              <label htmlFor="append-count" className="text-sm font-medium">
                {t("appendCountLabel", { max: append.maxAppendable })}
              </label>
              <div className="flex gap-2">
                <input
                  id="append-count"
                  type="number"
                  min={1}
                  max={append.maxAppendable}
                  value={Math.min(append.appendCount, append.maxAppendable)}
                  disabled={status.isGenerating}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    if (Number.isFinite(next)) {
                      append.onAppendCountChange(next)
                    }
                  }}
                  className="h-10 w-24 rounded-md border bg-background px-3 text-sm"
                  aria-label={t("appendCountAria")}
                />
                <Button
                  type="button"
                  className="flex-1"
                  disabled={!append.canAppend || status.isGenerating}
                  onClick={onAppendQuestions}
                >
                  {t("confirmAppend")}
                </Button>
              </div>
            </div>
          ) : null}

          {devTools.showDevMockToggle ? (
            <button
              type="button"
              onClick={devTools.onToggleGeneratedMock}
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
  form,
  credits,
  append,
  devTools,
  status,
  onGenerate,
  onAppendQuestions,
  hideHeader = false,
  header,
}: WorksheetConfigPanelProps & {
  hideHeader?: boolean
  header?: ReactNode
}) {
  const t = useTranslations("generate")
  const tCommon = useTranslations("common")

  const basicFields = <WorksheetBasicFields form={form} credits={credits} />

  const actionArea = (
    <WorksheetGenerationActions
      credits={credits}
      append={append}
      devTools={devTools}
      status={status}
      onGenerate={onGenerate}
      onAppendQuestions={onAppendQuestions}
    />
  )

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
        value={form.activeTab}
        onValueChange={(value) => form.onActiveTabChange(value as "basic" | "advanced")}
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

            <VariableConstraintPicker
              lesson={form.lesson}
              findVariableIds={form.findVariableIds}
              targetRandomize={form.targetRandomize}
              givenVariableIds={form.givenVariableIds}
              onFindChange={form.onFindVariableIdsChange}
              onTargetRandomizeChange={form.onTargetRandomizeChange}
              onGivenChange={form.onGivenVariableIdsChange}
              disabled={form.controlsDisabled}
            />

            <p className="text-xs text-muted-foreground">{t("variablesHint")}</p>

            {actionArea}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  )
}

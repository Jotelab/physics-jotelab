"use client"

import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formLabelClass } from "@/lib/ui-classes"
import type { WorksheetQuestion } from "@/features/generate/types"

export type EditQuestionDraft = {
  questionText: string
  givenValuesJson: string
  targetVariableJson: string
  solutionStepsText: string
  finalAnswer: string
}

export function getEditQuestionDraft(question: WorksheetQuestion): EditQuestionDraft {
  return {
    questionText: question.question_text,
    givenValuesJson: JSON.stringify(question.given_values, null, 2),
    targetVariableJson: JSON.stringify(question.target_variable, null, 2),
    solutionStepsText: question.solution.steps.join("\n"),
    finalAnswer: question.solution.final_answer,
  }
}

export function getEditedQuestionFromDraft(
  question: WorksheetQuestion,
  draft: EditQuestionDraft
): WorksheetQuestion {
  return {
    ...question,
    question_text: draft.questionText,
    given_values: JSON.parse(draft.givenValuesJson),
    target_variable: JSON.parse(draft.targetVariableJson),
    solution: {
      steps: draft.solutionStepsText
        .split("\n")
        .map((step) => step.trim())
        .filter(Boolean),
      final_answer: draft.finalAnswer,
    },
  }
}

export function EditQuestionDialog({
  draft,
  error,
  isSaving,
  onChange,
  onCancel,
  onSave,
}: {
  draft: EditQuestionDraft
  error: string | null
  isSaving: boolean
  onChange: (draft: EditQuestionDraft) => void
  onCancel: () => void
  onSave: () => void
}) {
  const t = useTranslations("worksheet")
  const tCommon = useTranslations("common")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 print:hidden">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-background p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t("editQuestion")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("manualEditsFree")}</p>
          </div>
          <Button type="button" size="icon-sm" variant="ghost" onClick={onCancel}>
            <span aria-hidden>x</span>
            <span className="sr-only">{tCommon("close")}</span>
          </Button>
        </div>

        <div className="space-y-4">
          <label className="block space-y-2">
            <span className={formLabelClass}>{t("questionText")}</span>
            <Textarea
              value={draft.questionText}
              onChange={(event) => onChange({ ...draft, questionText: event.target.value })}
              rows={3}
              className="resize-none"
            />
          </label>

          <label className="block space-y-2">
            <span className={formLabelClass}>{t("givenValuesJson")}</span>
            <Textarea
              value={draft.givenValuesJson}
              onChange={(event) => onChange({ ...draft, givenValuesJson: event.target.value })}
              rows={7}
              className="resize-y font-mono"
            />
          </label>

          <label className="block space-y-2">
            <span className={formLabelClass}>{t("targetVariableJson")}</span>
            <Textarea
              value={draft.targetVariableJson}
              onChange={(event) => onChange({ ...draft, targetVariableJson: event.target.value })}
              rows={4}
              className="resize-y font-mono"
            />
          </label>

          <label className="block space-y-2">
            <span className={formLabelClass}>{t("solutionSteps")}</span>
            <Textarea
              value={draft.solutionStepsText}
              onChange={(event) => onChange({ ...draft, solutionStepsText: event.target.value })}
              rows={5}
              className="resize-y"
            />
          </label>

          <label className="block space-y-2">
            <span className={formLabelClass}>{t("finalAnswerLabel")}</span>
            <Input
              value={draft.finalAnswer}
              onChange={(event) => onChange({ ...draft, finalAnswer: event.target.value })}
            />
          </label>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isSaving} onClick={onCancel}>
              {tCommon("cancel")}
            </Button>
            <Button type="button" disabled={isSaving} onClick={onSave}>
              {isSaving ? t("saving") : t("saveEdit")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

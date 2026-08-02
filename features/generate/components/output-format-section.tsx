"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { BuilderSelectDropdown } from "@/features/generate/components/builder-dropdown"
import {
  ANSWER_KEY_DETAIL_OPTIONS,
  DEFAULT_ANSWER_KEY_DETAIL,
  DEFAULT_INCLUDE_DIAGRAMS,
  DEFAULT_QUESTION_FORMAT,
  QUESTION_FORMAT_OPTIONS,
  type AnswerKeyDetail,
  type QuestionFormat,
} from "@/features/generate/constants/output-format-settings"
import { Switch } from "@/components/ui/switch"
import { formLabelClass } from "@/lib/ui-classes"

/**
 * Preview of planned output-format controls.
 *
 * The state below is deliberately local and write-only — it never leaves this
 * component, so toggling anything here has no effect on generation. The
 * "Coming soon" badge and hint keep that honest for the user.
 */
export function OutputFormatSection({ disabled }: { disabled?: boolean }) {
  const t = useTranslations("generate")

  const [includeDiagrams, setIncludeDiagrams] = useState(DEFAULT_INCLUDE_DIAGRAMS)
  const [answerKeyDetail, setAnswerKeyDetail] = useState<AnswerKeyDetail>(
    DEFAULT_ANSWER_KEY_DETAIL
  )
  const [questionFormat, setQuestionFormat] = useState<QuestionFormat>(DEFAULT_QUESTION_FORMAT)

  return (
    <fieldset className="space-y-4 rounded-lg border border-dashed p-4" disabled={disabled}>
      <legend className="flex items-center gap-2 px-1">
        <span className={formLabelClass}>{t("outputFormat.title")}</span>
        <span className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {t("outputFormat.comingSoon")}
        </span>
      </legend>

      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className={formLabelClass}>{t("outputFormat.includeDiagrams")}</span>
        <Switch
          id="include-diagrams-switch"
          checked={includeDiagrams}
          disabled={disabled}
          onCheckedChange={setIncludeDiagrams}
        />
      </label>

      <BuilderSelectDropdown
        label={t("outputFormat.answerKeyDetail.title")}
        id="answer-key-detail-select"
        listId="answer-key-detail-listbox"
        options={ANSWER_KEY_DETAIL_OPTIONS}
        value={answerKeyDetail}
        disabled={disabled}
        placeholder={t("outputFormat.answerKeyDetail.brief")}
        getKey={(option) => option.value}
        getLabel={(option) => t(option.labelKey)}
        onChange={(option) => setAnswerKeyDetail(option.value)}
      />

      <BuilderSelectDropdown
        label={t("outputFormat.questionFormat.title")}
        id="question-format-select"
        listId="question-format-listbox"
        options={QUESTION_FORMAT_OPTIONS}
        value={questionFormat}
        disabled={disabled}
        placeholder={t("outputFormat.questionFormat.word_problem")}
        getKey={(option) => option.value}
        getLabel={(option) => t(option.labelKey)}
        onChange={(option) => setQuestionFormat(option.value)}
      />

      <p className="text-xs text-muted-foreground">{t("outputFormat.hint")}</p>
    </fieldset>
  )
}

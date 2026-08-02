/**
 * Placeholder settings for the "Output format" section of the generate panel.
 *
 * These are UI-only: nothing here reaches the generation prompt, the engine, or
 * the stored worksheet. The section renders a "Coming soon" badge so the panel
 * previews planned controls without implying they change the output. When a
 * setting is actually implemented, move it out of this file into the real form
 * state (`useWorksheetConfigForm`) and drop its badge.
 */

export type AnswerKeyDetail = "brief" | "full_steps"
export type QuestionFormat = "word_problem" | "multi_part"

export const DEFAULT_INCLUDE_DIAGRAMS = true
export const DEFAULT_ANSWER_KEY_DETAIL: AnswerKeyDetail = "brief"
export const DEFAULT_QUESTION_FORMAT: QuestionFormat = "word_problem"

export const ANSWER_KEY_DETAIL_OPTIONS: { value: AnswerKeyDetail; labelKey: string }[] = [
  { value: "brief", labelKey: "outputFormat.answerKeyDetail.brief" },
  { value: "full_steps", labelKey: "outputFormat.answerKeyDetail.full_steps" },
]

export const QUESTION_FORMAT_OPTIONS: { value: QuestionFormat; labelKey: string }[] = [
  { value: "word_problem", labelKey: "outputFormat.questionFormat.word_problem" },
  { value: "multi_part", labelKey: "outputFormat.questionFormat.multi_part" },
]

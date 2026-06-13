import {
  MAX_EXTEND_QUESTIONS_PER_REQUEST,
  MAX_INITIAL_WORKSHEET_QUESTION_COUNT,
  MAX_WORKSHEET_QUESTION_COUNT,
} from "@/features/generate/limits"

export type ComputeWorksheetCreditLimitsInput = {
  availableCredits: number
  questionCount: number
  hasRequiredFields: boolean
  isGenerating: boolean
  worksheetId: string | null
  worksheetTargetCount: number | null
  questionsCount: number
  displayItemsCount: number
  hasActiveWorksheetMeta: boolean
  hasGeneratedMock: boolean
  isDev: boolean
}

export type ComputeWorksheetCreditLimitsResult = {
  maxQuestionCount: number
  effectiveQuestionCount: number
  cost: number
  hasNoCredits: boolean
  hasPartialCredits: boolean
  canGenerate: boolean
  maxAppendable: number
  canAppend: boolean
  hasGenerated: boolean
  hasActiveWorksheet: boolean
}

export function computeWorksheetCreditLimits(
  input: ComputeWorksheetCreditLimitsInput
): ComputeWorksheetCreditLimitsResult {
  const availableCredits = Math.max(0, input.availableCredits)
  const maxQuestionCount = Math.min(
    MAX_INITIAL_WORKSHEET_QUESTION_COUNT,
    Math.max(1, availableCredits)
  )
  const effectiveQuestionCount = Math.min(input.questionCount, maxQuestionCount)
  const cost = effectiveQuestionCount
  const hasNoCredits = availableCredits < 1
  const hasPartialCredits = availableCredits > 0 && cost > availableCredits
  const canGenerate = input.hasRequiredFields && !hasNoCredits && !input.isGenerating

  const hasGenerated =
    (input.isDev && input.hasGeneratedMock) ||
    Boolean(input.worksheetId && input.questionsCount > 0 && !input.isGenerating)

  const worksheetTargetCount = input.worksheetTargetCount
  const maxAppendable =
    worksheetTargetCount == null
      ? 0
      : Math.min(
          MAX_EXTEND_QUESTIONS_PER_REQUEST,
          Math.max(0, MAX_WORKSHEET_QUESTION_COUNT - worksheetTargetCount),
          availableCredits
        )

  const canAppend =
    Boolean(input.worksheetId) &&
    worksheetTargetCount != null &&
    !input.isGenerating &&
    availableCredits > 0 &&
    maxAppendable >= 1 &&
    hasGenerated

  const hasActiveWorksheet = Boolean(
    input.hasActiveWorksheetMeta && (input.isGenerating || input.displayItemsCount > 0)
  )

  return {
    maxQuestionCount,
    effectiveQuestionCount,
    cost,
    hasNoCredits,
    hasPartialCredits,
    canGenerate,
    maxAppendable,
    canAppend,
    hasGenerated,
    hasActiveWorksheet,
  }
}

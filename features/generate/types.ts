import type { z } from "zod"

import type { GenerationErrorCode } from "./errors"
import type {
  calculationQuestionSchema,
  conceptualDifficultySchema,
  generatedQuestionSchema,
  generateWorksheetInputSchema,
  givenVariableConstraintSchema,
  givenValueSchema,
  mathComplexitySchema,
  questionFormatSchema,
  subjectSchema,
  targetVariableSchema,
  variantLabelSchema,
  variantQuestionRollSchema,
  worksheetQuestionSchema,
  worksheetVariantSchema,
  worksheetVariantsPayloadSchema,
} from "./schemas"

export type Subject = z.infer<typeof subjectSchema>
export type MathComplexity = z.infer<typeof mathComplexitySchema>
export type ConceptualDifficulty = z.infer<typeof conceptualDifficultySchema>
export type GivenVariable = z.infer<typeof givenValueSchema>
export type GivenVariableConstraint = z.infer<typeof givenVariableConstraintSchema>
export type TargetVariable = z.infer<typeof targetVariableSchema>
export type GenerateWorksheetInput = z.infer<typeof generateWorksheetInputSchema>
export type QuestionFormat = z.infer<typeof questionFormatSchema>
export type CalculationQuestion = z.infer<typeof calculationQuestionSchema>
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>
export type WorksheetQuestion = z.infer<typeof worksheetQuestionSchema>

export type VariantLabel = z.infer<typeof variantLabelSchema>
export type VariantQuestionRoll = z.infer<typeof variantQuestionRollSchema>
export type WorksheetVariant = z.infer<typeof worksheetVariantSchema>
export type WorksheetVariantsPayload = z.infer<typeof worksheetVariantsPayloadSchema>
export type WorksheetVersionLabel = "A" | VariantLabel

export type SkippedSlot = {
  order: number
  message: string
  /**
   * Failure code of the skip, when the worker knew it. Lets the client render
   * a localized message (messages/{en,th}.json `errors` namespace) instead of
   * the server's English `message`, which stays as the fallback.
   */
  code?: GenerationErrorCode
}

export type VariantSkippedSlot = {
  order: number
  label: VariantLabel
  message: string
}

export type GenerationProgress = {
  current: number
  total: number
}

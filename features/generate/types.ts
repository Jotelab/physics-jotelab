import type { z } from "zod"

import type {
  conceptualDifficultySchema,
  generatedQuestionSchema,
  generateWorksheetInputSchema,
  givenValueSchema,
  mathComplexitySchema,
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
export type TargetVariable = z.infer<typeof targetVariableSchema>
export type GenerateWorksheetInput = z.infer<typeof generateWorksheetInputSchema>
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

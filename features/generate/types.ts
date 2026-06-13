import type { z } from "zod"

import type {
  generatedQuestionSchema,
  generateWorksheetInputSchema,
  givenValueSchema,
  subjectSchema,
  targetVariableSchema,
  worksheetQuestionSchema,
} from "./schemas"

export type Subject = z.infer<typeof subjectSchema>
export type GivenVariable = z.infer<typeof givenValueSchema>
export type TargetVariable = z.infer<typeof targetVariableSchema>
export type GenerateWorksheetInput = z.infer<typeof generateWorksheetInputSchema>
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>
export type WorksheetQuestion = z.infer<typeof worksheetQuestionSchema>

export type SkippedSlot = {
  order: number
  message: string
}

export type GenerationProgress = {
  current: number
  total: number
}

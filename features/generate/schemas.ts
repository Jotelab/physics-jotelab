import { z } from "zod"

import {
  MAX_FINAL_ANSWER_LEN,
  MAX_GIVEN_STRING_VALUE_LEN,
  MAX_GIVEN_VARIABLES,
  MAX_HEADER_INSTRUCTIONS_LEN,
  MAX_HEADER_TITLE_LEN,
  MAX_INITIAL_WORKSHEET_QUESTION_COUNT,
  MAX_LABEL_LEN,
  MAX_LESSON_LEN,
  MAX_QUESTION_TEXT_LEN,
  MAX_SCENARIO_LEN,
  MAX_SOLUTION_STEP_LEN,
  MAX_SOLUTION_STEPS,
  MAX_SYMBOL_LEN,
  MAX_TARGET_VARIABLES,
  MAX_UNIT_LEN,
  MAX_WORKSHEET_QUESTION_COUNT,
} from "./limits"

// Allowlist of subjects the app can persist and generate for. Adding a subject
// here (plus the matching `is_valid_subject` DB allowlist and a content pack —
// see features/generate/data/subjects.ts) is all that is required to widen the
// `subject` surface end-to-end.
export const SUBJECTS = ["physics"] as const

export const subjectSchema = z.enum(SUBJECTS)

export const DEFAULT_SUBJECT = SUBJECTS[0]

export const mathComplexitySchema = z.enum(["integers", "decimals", "scientific"])

export const conceptualDifficultySchema = z.enum(["level_1", "level_2", "level_3"])

export const givenValueSchema = z.object({
  symbol: z.string().min(1).max(MAX_SYMBOL_LEN),
  label: z.string().min(1).max(MAX_LABEL_LEN),
  value: z.union([
    z.number(),
    z.string().min(1).max(MAX_GIVEN_STRING_VALUE_LEN),
  ]),
  unit: z.string().min(1).max(MAX_UNIT_LEN).optional(),
})

export const targetVariableSchema = z.object({
  symbol: z.string().min(1).max(MAX_SYMBOL_LEN),
  label: z.string().min(1).max(MAX_LABEL_LEN),
  unit: z.string().min(1).max(MAX_UNIT_LEN).optional(),
})

export const worksheetHeaderFieldTogglesSchema = z.object({
  showStudentName: z.boolean(),
  showDate: z.boolean(),
  showClassSection: z.boolean(),
  showScoreBox: z.boolean(),
})

export const worksheetHeaderConfigSchema = z.object({
  title: z.string().trim().min(1).max(MAX_HEADER_TITLE_LEN).optional(),
  instructions: z.string().trim().min(1).max(MAX_HEADER_INSTRUCTIONS_LEN).optional(),
  fields: worksheetHeaderFieldTogglesSchema.optional(),
})

export const generationSettingsSchema = z.object({
  lesson: z.string().trim().min(1).max(MAX_LESSON_LEN),
  scenario: z.string().trim().min(1).max(MAX_SCENARIO_LEN),
  given_variables: z.array(givenValueSchema).max(MAX_GIVEN_VARIABLES).optional(),
  target_variables: z.array(targetVariableSchema).max(MAX_TARGET_VARIABLES).optional(),
  target_randomize: z.boolean().optional(),
  math_complexity: mathComplexitySchema.optional(),
  conceptual_difficulty: conceptualDifficultySchema.optional(),
  header: worksheetHeaderConfigSchema.optional(),
})

export const generateWorksheetInputSchema = z.object({
  subject: subjectSchema,
  lesson: z.string().trim().min(1).max(MAX_LESSON_LEN),
  scenario: z.string().trim().min(1).max(MAX_SCENARIO_LEN),
  question_count: z.number().int().min(1).max(MAX_INITIAL_WORKSHEET_QUESTION_COUNT),
  given_variables: z.array(givenValueSchema).max(MAX_GIVEN_VARIABLES).optional(),
  target_variables: z.array(targetVariableSchema).max(MAX_TARGET_VARIABLES).optional(),
  target_randomize: z.boolean().optional(),
  math_complexity: mathComplexitySchema.optional(),
  conceptual_difficulty: conceptualDifficultySchema.optional(),
})

const solutionSchema = z.object({
  steps: z
    .array(z.string().min(1).max(MAX_SOLUTION_STEP_LEN))
    .min(1)
    .max(MAX_SOLUTION_STEPS),
  final_answer: z.string().min(1).max(MAX_FINAL_ANSWER_LEN),
})

export const generatedQuestionSchema = z.object({
  question_text: z.string().min(1).max(MAX_QUESTION_TEXT_LEN),
  given_values: z.array(givenValueSchema).min(1).max(MAX_GIVEN_VARIABLES),
  target_variable: targetVariableSchema,
  solution: solutionSchema,
})

export const worksheetQuestionSchema = generatedQuestionSchema.extend({
  id: z.string().uuid(),
  order: z.number().int().min(1).max(MAX_WORKSHEET_QUESTION_COUNT),
})

export const variantLabelSchema = z.enum(["B", "C", "D"])

export const variantQuestionRollSchema = z.object({
  order: z.number().int().min(1).max(MAX_WORKSHEET_QUESTION_COUNT),
  given_values: z.array(givenValueSchema).min(1).max(MAX_GIVEN_VARIABLES),
  solution: solutionSchema,
  question_text: z.string().min(1).max(MAX_QUESTION_TEXT_LEN).optional(),
})

export const worksheetVariantSchema = z.object({
  id: z.string().uuid(),
  label: variantLabelSchema,
  createdAt: z.string().min(1),
  rolls: z.array(variantQuestionRollSchema).min(1).max(MAX_WORKSHEET_QUESTION_COUNT),
})

export const worksheetVariantsPayloadSchema = z.object({
  saved: z.array(worksheetVariantSchema).max(3),
})

export const variantSkippedSlotSchema = z.object({
  order: z.number().int().min(1),
  label: variantLabelSchema,
  message: z.string().min(1),
})

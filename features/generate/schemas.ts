import { z } from "zod"

import { sympyDataSchema } from "@/lib/engine/sympy-data"

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
  MAX_DIAGRAM_SVG_LEN,
  MAX_SYMBOL_LEN,
  MAX_TARGET_VARIABLES,
  MAX_TIKZ_CODE_LEN,
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

// Question formats are modeled as a discriminated union keyed by `format` so a
// new subject can introduce a non-calculation shape (multiple-choice, labeling,
// essay, …) without reshaping the calculation question. Adding a format means
// adding a member to `generatedQuestionSchema` / `worksheetQuestionSchema` and a
// matching renderer — the calculation members below stay untouched.
//
// `format` is a derived/transport discriminant: it is not persisted as a column
// (the DB stores calculation questions by their fields), so stored/legacy rows
// omit it and `withDefaultQuestionFormat` re-injects the default on read.
export const QUESTION_FORMATS = ["calculation"] as const

export const questionFormatSchema = z.enum(QUESTION_FORMATS)

export const calculationQuestionSchema = z.object({
  format: z.literal("calculation").default("calculation"),
  question_text: z.string().min(1).max(MAX_QUESTION_TEXT_LEN),
  given_values: z.array(givenValueSchema).min(1).max(MAX_GIVEN_VARIABLES),
  target_variable: targetVariableSchema,
  solution: solutionSchema,
  // Verbatim engine payload every number traces back to (DEVELOPMENT_PLAN §1.2).
  // Optional: LLM-only lessons and legacy rows omit it; the neuro-symbolic path
  // attaches it. It is never model-authored — the LLM output schemas leave it
  // unset and it is assembled from the engine response.
  sympy_data: sympyDataSchema.optional(),
  // TikZ diagram source (DEVELOPMENT_PLAN §2.1). Optional: questions without a
  // diagram omit it. This is the durable, persisted field; the compiled SVG
  // below is derived from it server-side, not authored by hand.
  tikz_code: z.string().min(1).max(MAX_TIKZ_CODE_LEN).optional(),
  // Compiled, self-contained vector SVG for `tikz_code`, assembled server-side
  // (see `lib/tikz`). Render-time only — carried on the question object so the
  // A4 canvas can paginate/print it synchronously, but not persisted inline.
  diagram_svg: z.string().min(1).max(MAX_DIAGRAM_SVG_LEN).optional(),
})

// The "Structured AI Output" split (DEVELOPMENT_PLAN §2.2, proposal): the model
// authors only prose + math — `question_text` (text) and `solution` (katex) — and
// never the diagram or the engine payload. `tikz_code` is separated out (it comes
// from the deterministic engine template, or a *validated* LLM diagram later),
// `diagram_svg` is compiled server-side, and `sympy_data` originates in the
// engine. Passing this narrower schema to `generateObject` keeps those three
// fields out of the model's structured output — so a model can't emit a
// compiled/engine field the DB allowlist would reject.
export const modelCalculationOutputSchema = calculationQuestionSchema.omit({
  tikz_code: true,
  diagram_svg: true,
  sympy_data: true,
})

const calculationWorksheetQuestionSchema = calculationQuestionSchema.extend({
  id: z.string().uuid(),
  order: z.number().int().min(1).max(MAX_WORKSHEET_QUESTION_COUNT),
})

function withDefaultQuestionFormat(value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !("format" in value)
  ) {
    return { ...(value as Record<string, unknown>), format: "calculation" }
  }
  return value
}

export const generatedQuestionSchema = z.preprocess(
  withDefaultQuestionFormat,
  z.discriminatedUnion("format", [calculationQuestionSchema])
)

export const worksheetQuestionSchema = z.preprocess(
  withDefaultQuestionFormat,
  z.discriminatedUnion("format", [calculationWorksheetQuestionSchema])
)

export const variantLabelSchema = z.enum(["B", "C", "D"])

export const variantQuestionRollSchema = z.object({
  order: z.number().int().min(1).max(MAX_WORKSHEET_QUESTION_COUNT),
  given_values: z.array(givenValueSchema).min(1).max(MAX_GIVEN_VARIABLES),
  solution: solutionSchema,
  question_text: z.string().min(1).max(MAX_QUESTION_TEXT_LEN).optional(),
  // Engine-backed rolls re-roll through the symbolic engine (same Given/Find
  // split, fresh seed) and carry its verified payload, exactly like a question
  // (DEVELOPMENT_PLAN §1.2). LLM-only lessons omit it.
  sympy_data: sympyDataSchema.optional(),
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

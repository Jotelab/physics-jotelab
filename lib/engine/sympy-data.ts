import { z } from "zod"

/**
 * Zod mirror of the Python engine's locked `sympy_data` contract
 * (jotelab-ai `engine/contract.py`, DEVELOPMENT_PLAN §1.2).
 *
 * The engine is the single source of truth for every number a student sees; this
 * schema parses its payload at the trust boundary so nothing downstream has to
 * guess the shape. Two-repo drift is guarded by keeping this in lock-step with
 * `build_sympy_data` — the field names and nesting here match it exactly.
 *
 * **Exactness (ADR-005).** Every numeric field carries two forms: `exact` — a
 * canonical, losslessly-reloadable string that is the *authoritative* value
 * (e.g. `"1/3"`) — and `value` — a JSON display number that is *presentation
 * only* and may be a lossy round of a non-terminating rational. Assembly and the
 * Data Fidelity check use `exact` / `latex`; nothing trusts `value` as truth.
 */

export const sympyNumberSchema = z.object({
  value: z.number(),
  exact: z.string().min(1),
  unit: z.string(),
})

export const sympyGivenSchema = sympyNumberSchema.extend({
  symbol: z.string().min(1),
})

export const sympyFindSchema = sympyNumberSchema.extend({
  symbol: z.string().min(1),
})

export const sympyStepSchema = z.object({
  expr_latex: z.string().min(1),
  substituted_latex: z.string().min(1),
  result_latex: z.string().min(1),
})

export const sympyFinalAnswerSchema = sympyNumberSchema.extend({
  latex: z.string().min(1),
})

export const sympyDataSchema = z.object({
  topic: z.string().min(1),
  seed: z.number().int(),
  given: z.array(sympyGivenSchema).min(1),
  find: sympyFindSchema,
  steps: z.array(sympyStepSchema).min(1),
  final_answer: sympyFinalAnswerSchema,
  policy_applied: z.string().min(1),
  plausible: z.boolean(),
})

export type SympyData = z.infer<typeof sympyDataSchema>
export type SympyGiven = z.infer<typeof sympyGivenSchema>
export type SympyFind = z.infer<typeof sympyFindSchema>
export type SympyStep = z.infer<typeof sympyStepSchema>

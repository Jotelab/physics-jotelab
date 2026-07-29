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

export const sympyAuxiliarySchema = sympyNumberSchema.extend({
  symbol: z.string().min(1),
})

/**
 * The engine's figure payload (engine-owned TikZ work, jotelab-ai
 * `templates/diagrams.py`).
 *
 * Kept deliberately loose (`z.unknown()`): the renderer switches on `kind`, and
 * pinning the segment/total shape here would mean re-editing this file every
 * time the engine grows a role. Displaying it raw keeps drift visible rather
 * than silently swallowed.
 */
export const sympyDiagramSchema = z.unknown()

export const sympyDataSchema = z.object({
  topic: z.string().min(1),
  seed: z.number().int(),
  given: z.array(sympyGivenSchema).min(1),
  find: sympyFindSchema,
  steps: z.array(sympyStepSchema).min(1),
  final_answer: sympyFinalAnswerSchema,
  policy_applied: z.string().min(1),
  plausible: z.boolean(),
  /**
   * Both emitted by the engine today; a Zod object strips keys it does not
   * declare, so omitting them silently dropped them at the trust boundary
   * (found on the sandbox testbench). `auxiliary` carries a system template's
   * internal unknowns (the meet point of a pursuit, the burn-out velocity of a
   * two-phase ascent); `diagram` carries the engine-authored figure that
   * replaced LLM-drawn TikZ.
   */
  auxiliary: z.array(sympyAuxiliarySchema).optional(),
  diagram: sympyDiagramSchema.optional(),
})

export type SympyData = z.infer<typeof sympyDataSchema>
export type SympyGiven = z.infer<typeof sympyGivenSchema>
export type SympyFind = z.infer<typeof sympyFindSchema>
export type SympyStep = z.infer<typeof sympyStepSchema>
export type SympyAuxiliary = z.infer<typeof sympyAuxiliarySchema>

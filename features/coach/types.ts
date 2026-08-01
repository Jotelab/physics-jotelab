import type { SympyData } from "@/lib/engine/sympy-data"

/**
 * Interactive Coaching MVP (DEVELOPMENT_PLAN Phase C1, "Application-as-Teacher").
 *
 * The student solves an engine-generated SUVAT problem in three checked steps —
 * ① choose the equation, ② substitute values, ③ compute the answer — and every
 * check compares the student's *structured* input against `sympy_data`, the
 * engine's own verified solution. The engine is the oracle; no LLM judges
 * anything (rev. 2 invariant: the app teaches, the engine grades).
 */

/** The three checked steps of a coached solve. */
export type CoachStep = "equation" | "substitution" | "answer"

/**
 * The engine's difficulty band, mirrored here so client-side coaching modules
 * (`remediation.ts`, the session UI) can name it without importing the
 * server-only engine client.
 */
export type CoachDifficulty = "easy" | "medium" | "hard"

/**
 * The misconception taxonomy (C1.2 minimum SUVAT set). `value-slip` is the
 * catch-all for a substitution that is wrong but matches no known pattern —
 * still logged, per the risk register ("unmatched errors get a generic hint").
 */
export type CoachErrorType =
  | "wrong-equation"
  | "swapped-variables"
  | "sign-error"
  | "unit-slip"
  | "arithmetic-slip"
  | "value-slip"

/** One multiple-choice option for step ① (a SUVAT relation). */
export type EquationOption = {
  /** Stable id of the relation in the bank, e.g. `"v-uat"`. */
  id: string
  /** Display LaTeX of the relation, e.g. `"v = u + at"`. */
  latex: string
}

/** One fill-in field for step ② — a given the chosen equation consumes. */
export type SubstitutionField = {
  /** Engine variable name (`u`, `a`, `t`, …). */
  symbol: string
  /** Product display symbol (`v₀` for `u`). */
  displaySymbol: string
  /** Learner-facing Thai label. */
  label: string
  unit: string
  /** Authoritative numeric value (parsed from the engine's `exact`). */
  value: number
}

/** Everything the coaching UI needs, all derived from `sympy_data`. */
export type CoachProblem = {
  /** Deterministic Thai problem statement assembled from the givens (no LLM). */
  questionText: string
  /** Step ① options (correct relation + distractors, deterministic order). */
  equationOptions: EquationOption[]
  /** Id of the correct relation for this Given/Find split. */
  correctEquationId: string
  /** Step ② fields, one per given, in equation-bank order. */
  substitutionFields: SubstitutionField[]
  /** Step ③ oracle: the final answer. */
  answer: {
    value: number
    exact: string
    unit: string
    latex: string
  }
  /** Display metadata for the Find variable. */
  find: { symbol: string; displaySymbol: string; label: string; unit: string }
  /** The engine's worked step LaTeX, for the final hint level (reveal). */
  workedStep: {
    exprLatex: string
    substitutedLatex: string
    resultLatex: string
  }
  /** The raw engine payload (stored/logged verbatim per the contract). */
  sympyData: SympyData
}

/** Result of checking one structured student input against the oracle. */
export type CheckResult =
  | { ok: true }
  | {
      ok: false
      errorType: CoachErrorType
      /** Engine variable name(s) involved, when the check can localize it. */
      symbols?: string[]
    }

/**
 * One logged attempt (C1.3 floor): feeds the Coaching Effectiveness metric.
 * Persistence to Supabase is future work — the record shape is the contract.
 */
export type AttemptRecord = {
  /** `topic:seed:find` — enough to re-derive the exact question. */
  questionKey: string
  step: CoachStep
  /** The student's raw structured input, serialized. */
  input: string
  errorType: CoachErrorType | null
  hintsUsed: number
  solved: boolean
  at: string
}

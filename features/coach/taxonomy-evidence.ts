import type { CoachErrorType } from "./types"

/**
 * Evidence for (or against) the misconception taxonomy.
 *
 * The six categories in {@link CoachErrorType} were chosen by hand. That is an
 * honest starting point and a weak claim: nothing so far shows they describe
 * the mistakes Thai students actually make. This module turns the taxonomy from
 * an assertion into something falsifiable, using the attempt log the app
 * already writes.
 *
 * The test is the **catch-all share**. `value-slip` and `arithmetic-slip` are
 * the buckets the classifier falls back to when it recognises *that* an answer
 * is wrong but not *why*. A specific diagnosis is the product's whole claim
 * ("hints targeted at your mistake"), so if most real errors land in the
 * fallbacks, the taxonomy is not doing its job — no matter how reasonable the
 * categories look on paper.
 *
 * Stating the threshold in advance is the point: it is a prediction that can
 * fail, not a description that cannot.
 */

/** Buckets that mean "wrong, cause unidentified". */
export const CATCH_ALL_ERRORS: readonly CoachErrorType[] = [
  "value-slip",
  "arithmetic-slip",
]

/**
 * Above this share of catch-all diagnoses, treat the taxonomy as unsupported
 * and revise it — the classifier is detecting errors it cannot explain.
 */
export const CATCH_ALL_CEILING = 0.5

/** Below this many diagnoses, any share is noise. */
export const MIN_SAMPLE = 30

export type TaxonomyEvidence = {
  /** Diagnoses counted. */
  total: number
  /** Count per category, highest first, then alphabetical for stability. */
  distribution: { errorType: CoachErrorType; count: number; share: number }[]
  /** Fraction landing in {@link CATCH_ALL_ERRORS}. */
  catchAllShare: number
  /** `true` once {@link MIN_SAMPLE} diagnoses exist. */
  hasEnoughData: boolean
  /**
   * The taxonomy's own verdict on itself:
   * - `insufficient-data` — not enough diagnoses to say anything
   * - `supported` — most errors get a specific diagnosis
   * - `unsupported` — the catch-alls dominate; revise the categories
   */
  verdict: "insufficient-data" | "supported" | "unsupported"
}

export function summarizeTaxonomyEvidence(
  errorTypes: readonly CoachErrorType[]
): TaxonomyEvidence {
  const total = errorTypes.length

  const counts = new Map<CoachErrorType, number>()
  for (const errorType of errorTypes) {
    counts.set(errorType, (counts.get(errorType) ?? 0) + 1)
  }

  const distribution = [...counts.entries()]
    .map(([errorType, count]) => ({
      errorType,
      count,
      share: total === 0 ? 0 : count / total,
    }))
    .sort((a, b) => b.count - a.count || a.errorType.localeCompare(b.errorType))

  const catchAll = errorTypes.filter((errorType) =>
    CATCH_ALL_ERRORS.includes(errorType)
  ).length
  const catchAllShare = total === 0 ? 0 : catchAll / total
  const hasEnoughData = total >= MIN_SAMPLE

  return {
    total,
    distribution,
    catchAllShare,
    hasEnoughData,
    verdict: !hasEnoughData
      ? "insufficient-data"
      : catchAllShare > CATCH_ALL_CEILING
        ? "unsupported"
        : "supported",
  }
}

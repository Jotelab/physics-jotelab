import type { CoachErrorType, CoachStep } from "./types"

/**
 * The minimal progress view's aggregation (C1.3): problems solved and the
 * student's most common error types, computed from their `coaching_attempts`
 * rows. Pure so the dashboard card stays a thin query-and-render shell.
 */

/** The columns the progress view selects from `coaching_attempts`. */
export type CoachingAttemptRow = {
  question_key: string
  step: CoachStep
  error_type: CoachErrorType | null
  solved: boolean
}

export type CoachingProgressSummary = {
  /** Distinct questions whose answer step was solved. */
  problemsSolved: number
  /** Every checked input, right or wrong. */
  attempts: number
  /** Most frequent error types, count desc then alphabetical, top three. */
  topErrors: { errorType: CoachErrorType; count: number }[]
}

export function summarizeAttempts(
  rows: readonly CoachingAttemptRow[]
): CoachingProgressSummary {
  const solvedKeys = new Set<string>()
  const errorCounts = new Map<CoachErrorType, number>()

  for (const attempt of rows) {
    if (attempt.step === "answer" && attempt.solved) {
      solvedKeys.add(attempt.question_key)
    }
    if (attempt.error_type) {
      errorCounts.set(attempt.error_type, (errorCounts.get(attempt.error_type) ?? 0) + 1)
    }
  }

  const topErrors = [...errorCounts.entries()]
    .map(([errorType, count]) => ({ errorType, count }))
    .sort(
      (a, b) => b.count - a.count || a.errorType.localeCompare(b.errorType)
    )
    .slice(0, 3)

  return { problemsSolved: solvedKeys.size, attempts: rows.length, topErrors }
}

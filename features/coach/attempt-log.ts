import type { AttemptRecord } from "./types"

/**
 * Attempt logging (C1.3 floor): every checked input becomes a record —
 * `(questionKey, step, input, errorType, hintsUsed, solved)` — the exact shape
 * the Coaching Effectiveness metric (C4) consumes.
 *
 * v1 keeps records in memory and mirrors them to the console (tagged
 * `[coach-attempt]`, same pattern as the TikZ compile-rate log) so a pilot
 * session's log can be harvested from the browser console. The Supabase
 * attempts table is named future work in the plan; when it lands, `record`
 * grows a transport without the call sites changing.
 */

const records: AttemptRecord[] = []

export function recordAttempt(attempt: Omit<AttemptRecord, "at">): AttemptRecord {
  const full: AttemptRecord = { ...attempt, at: new Date().toISOString() }
  records.push(full)
  console.info("[coach-attempt]", JSON.stringify(full))
  return full
}

/** All records of this session (for the progress view / metric export). */
export function attemptLog(): readonly AttemptRecord[] {
  return records
}

export function clearAttemptLog(): void {
  records.length = 0
}

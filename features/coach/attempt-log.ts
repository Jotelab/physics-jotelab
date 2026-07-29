import type { AttemptRecord } from "./types"

/**
 * Attempt logging (C1.3 floor): every checked input becomes a record —
 * `(questionKey, step, input, errorType, hintsUsed, solved)` — the exact shape
 * the Coaching Effectiveness metric (C4) consumes.
 *
 * Records live in memory and mirror to the console (tagged `[coach-attempt]`,
 * same pattern as the TikZ compile-rate log) so a pilot session's log can be
 * harvested from the browser console. A registered transport additionally
 * persists each record (the Supabase `coaching_attempts` table) — best-effort:
 * a failing transport never blocks or breaks the solve.
 */

const records: AttemptRecord[] = []

export type AttemptTransport = (record: AttemptRecord) => Promise<unknown>

let transport: AttemptTransport | null = null

/** Register (or clear, with `null`) the persistence transport. */
export function setAttemptTransport(next: AttemptTransport | null): void {
  transport = next
}

export function recordAttempt(attempt: Omit<AttemptRecord, "at">): AttemptRecord {
  const full: AttemptRecord = { ...attempt, at: new Date().toISOString() }
  records.push(full)
  console.info("[coach-attempt]", JSON.stringify(full))
  if (transport) {
    void transport(full).catch(() => {
      // Persistence is best-effort; the in-memory log above already has it.
    })
  }
  return full
}

/** All records of this session (for the progress view / metric export). */
export function attemptLog(): readonly AttemptRecord[] {
  return records
}

export function clearAttemptLog(): void {
  records.length = 0
}

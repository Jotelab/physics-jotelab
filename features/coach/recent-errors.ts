import "server-only"

import { createClient } from "@/lib/supabase/server"

import type { CoachErrorType } from "./types"

/**
 * The signed-in student's recent misconceptions, newest first.
 *
 * Remediation consults this so a gap the student keeps returning to outranks a
 * single clean solve (`remediation.ts`, `PERSISTENCE_THRESHOLD`). Without it the
 * coach has amnesia between problems: a student who has made sign errors in
 * nine straight sessions would be treated exactly like one who slipped once.
 *
 * Returns `[]` for anonymous solves or any query failure — the coach must work
 * with no account and no Supabase, so this can never be the reason `/learn`
 * fails to render.
 */

/** Enough history to see a trend without letting last month dominate. */
const RECENT_ATTEMPT_LIMIT = 40

export async function fetchRecentErrorTypes(): Promise<CoachErrorType[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("coaching_attempts")
      .select("error_type")
      .not("error_type", "is", null)
      .order("created_at", { ascending: false })
      .limit(RECENT_ATTEMPT_LIMIT)

    if (error || !data) return []

    return data
      .map((row) => (row as { error_type: CoachErrorType | null }).error_type)
      .filter((errorType): errorType is CoachErrorType => errorType !== null)
  } catch {
    return []
  }
}

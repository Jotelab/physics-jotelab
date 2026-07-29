"use server"

import { createClient } from "@/lib/supabase/server"

import type { AttemptRecord } from "./types"

/**
 * Best-effort persistence for coaching attempts (C1.3): signed-in students'
 * attempts land in `coaching_attempts` via the `record_coaching_attempt` RPC
 * (security definer, resolves the profile from `auth.uid()` — same write
 * pattern as the generation RPCs). Anonymous `/learn` solves stay console-only
 * by design: the coaching surface must keep working with no account and no
 * Supabase, so every failure here degrades to `persisted: false`, never a
 * throw.
 */

export type PersistAttemptResult =
  | { persisted: true }
  | { persisted: false; reason: "anonymous" | "error" }

export async function persistAttempt(
  record: AttemptRecord
): Promise<PersistAttemptResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { persisted: false, reason: "anonymous" }
    }

    const { error } = await supabase.rpc("record_coaching_attempt", {
      p_question_key: record.questionKey,
      p_step: record.step,
      p_input: record.input,
      p_error_type: record.errorType,
      p_hints_used: record.hintsUsed,
      p_solved: record.solved,
    })

    if (error) {
      return { persisted: false, reason: "error" }
    }

    return { persisted: true }
  } catch {
    return { persisted: false, reason: "error" }
  }
}

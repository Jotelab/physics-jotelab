import { createServiceRoleClient } from "@/lib/supabase/admin"
import {
  syncGenerationJobStep,
  type GenerationJobStep,
} from "@/lib/inngest/generation-job-step"

/**
 * A generation job stuck in `queued`/`running` past this many minutes is treated
 * as dead — its Inngest run vanished without reaching `onFailure` — and reaped to
 * `failed`, freeing the one-active-per-worksheet index. Comfortably longer than
 * any real generation, which is minutes at most.
 */
export const STUCK_JOB_TTL_MINUTES = 30

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

/**
 * Scheduled housekeeping for the generation pipeline. Both RPCs are service-role
 * and otherwise only run lazily (reservation cleanup happens inside `reserve_*`,
 * and a job is only failed in-band), so without this sweep abandoned reservations
 * accumulate and a dead `running` job blocks its worksheet forever.
 */
export async function runStaleGenerationSweep(
  step: GenerationJobStep = syncGenerationJobStep
) {
  const admin = createServiceRoleClient()

  const reservationsCleaned = await step.run("cleanup-expired-reservations", async () => {
    const { data, error } = await admin.rpc("cleanup_expired_credit_reservations")
    if (error) {
      throw new Error(error.message)
    }
    return asCount(data)
  })

  const jobsReaped = await step.run("reap-stuck-jobs", async () => {
    const { data, error } = await admin.rpc("reap_stuck_generation_jobs", {
      p_older_than_minutes: STUCK_JOB_TTL_MINUTES,
    })
    if (error) {
      throw new Error(error.message)
    }
    return asCount(data)
  })

  return { reservationsCleaned, jobsReaped }
}

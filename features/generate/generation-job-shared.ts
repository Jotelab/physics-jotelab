import "server-only"

import { inngest } from "@/lib/inngest/client"
import { runGenerationJobWorker } from "@/lib/inngest/run-generation-job-worker"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import type { createClient } from "@/lib/supabase/server"

import { parseRpcFailure, parseStructuredRpcFailure } from "./errors"
import type { ActionResult } from "./result-types"

/**
 * Helpers shared by the generation-job server actions (standard questions in
 * `generation-job-actions.ts`, variant rolls in `variant-actions.ts`). One
 * copy of the auth-profile lookup, the failed-job cleanup, the Inngest
 * dispatch, and the RPC failure envelope so the two action files cannot drift.
 */

export type ProfileIdRow = {
  id: string
  credit_balance: number
}

export async function getProfileForAuthUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authUserId: string
): Promise<ProfileIdRow | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, credit_balance")
    .eq("auth_user_id", authUserId)
    .single<ProfileIdRow>()

  return data ?? null
}

export async function markGenerationJobFailed(
  jobId: string,
  profileId: string,
  errorMessage: string
) {
  try {
    const admin = createServiceRoleClient()
    // Scope the cleanup to the authenticated owner: the service-role client
    // bypasses RLS, so matching on user_id (not just the server-minted jobId)
    // ensures a stray/client-influenced id could never fail another user's job.
    await admin
      .from("generation_jobs")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", jobId)
      .eq("user_id", profileId)
  } catch {
    // Best-effort cleanup so a failed Inngest send does not leave a blocking queued job.
  }
}

export async function sendGenerationJobEvent(params: {
  jobId: string
  worksheetId: string
  profileId: string
}) {
  if (process.env.E2E_STUB_GENERATION === "true") {
    // The worker resolves the job kind itself, so both standard and variant
    // jobs run synchronously through the same stub entry point.
    await runGenerationJobWorker(params)
    return
  }

  if (!process.env.INNGEST_EVENT_KEY) {
    throw new Error("Background generation is not configured (INNGEST_EVENT_KEY).")
  }

  await inngest.send({
    name: "worksheet/generation.requested",
    data: params,
  })
}

export function parseRpcActionFailure<T>(
  data: unknown,
  error: unknown,
  fallbackMessage: string
): ActionResult<T> | null {
  const structured = parseStructuredRpcFailure(data, "UNKNOWN", fallbackMessage)
  if (structured) {
    return structured
  }

  if (error) {
    return parseRpcFailure(error, "UNKNOWN", fallbackMessage)
  }

  return null
}

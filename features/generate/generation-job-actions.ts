"use server"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { z } from "zod"

import { inngest } from "@/lib/inngest/client"
import { runGenerationJobWorker } from "@/lib/inngest/run-generation-job-worker"
import { localizedFailure } from "@/lib/i18n/server-errors"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

import { buildGenerationSettingsPayload, getWorksheetTitle } from "./actions-shared"
import { failure, parseRpcFailure, parseStructuredRpcFailure, parseRpcSuccessNumberField, parseRpcSuccessStringField } from "./errors"
import {
  type GenerationJobRow,
  generationJobStatusSchema,
} from "./generation-job-types"
import { MAX_EXTEND_QUESTIONS_PER_REQUEST } from "./limits"
import type { ActionResult } from "./result-types"
import { generateWorksheetInputSchema } from "./schemas"
import type { GenerateWorksheetInput } from "./types"
import { fetchWorksheetQuestions } from "./utils/fetch-worksheet-questions"
import { mapGenerationJobPoll } from "./utils/map-generation-job-poll"

type ProfileIdRow = {
  id: string
  credit_balance: number
}

async function getProfileForAuthUser(
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

async function markGenerationJobFailed(
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

async function deleteOrphanWorksheet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  worksheetId: string
) {
  try {
    // Cascades to the generation_jobs row, so an enqueue/send failure after init
    // does not leave behind an empty worksheet (init charges no credits).
    await supabase.from("worksheets").delete().eq("id", worksheetId)
  } catch {
    // Best-effort cleanup.
  }
}

async function sendGenerationJobEvent(params: {
  jobId: string
  worksheetId: string
  profileId: string
}) {
  if (process.env.E2E_STUB_GENERATION === "true") {
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

const appendJobInputSchema = z.object({
  worksheetId: z.string().uuid(),
  additionalCount: z.number().int().min(1).max(MAX_EXTEND_QUESTIONS_PER_REQUEST),
})

const jobIdSchema = z.string().uuid()

const worksheetIdSchema = z.string().uuid()

function parseRpcActionFailure<T>(
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

export async function startWorksheetGenerationJobAction(
  input: GenerateWorksheetInput
): Promise<ActionResult<{ jobId: string; worksheetId: string }>> {
  const parsed = generateWorksheetInputSchema.safeParse(input)
  const t = await getTranslations("errors")

  if (!parsed.success) {
    return localizedFailure("VALIDATION_FAILED", "completeWorksheetSettings")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return localizedFailure("NOT_AUTHENTICATED", "notAuthenticatedGenerate")
  }

  const profile = await getProfileForAuthUser(supabase, user.id)

  if (!profile) {
    return localizedFailure("PROFILE_NOT_FOUND")
  }

  const { data: initData, error: initError } = await supabase.rpc("generate_worksheet_init", {
    p_title: getWorksheetTitle(parsed.data),
    p_subject: parsed.data.subject,
    p_question_count: parsed.data.question_count,
    p_generation_settings: buildGenerationSettingsPayload(parsed.data),
  })

  const initFailure = parseRpcActionFailure<{ jobId: string; worksheetId: string }>(
    initData,
    initError,
    t("couldNotStartGeneration")
  )
  if (initFailure) {
    return initFailure
  }

  const worksheetId = parseRpcSuccessStringField(initData, "worksheetId")
  if (!worksheetId) {
    return localizedFailure("UNKNOWN", "couldNotStartGeneration")
  }

  const { data: jobData, error: enqueueError } = await supabase.rpc("enqueue_generation_job", {
    p_worksheet_id: worksheetId,
    p_from_order: 1,
    p_to_order: parsed.data.question_count,
    p_kind: "initial",
  })

  const enqueueFailure = parseRpcActionFailure<{ jobId: string; worksheetId: string }>(
    jobData,
    enqueueError,
    t("couldNotStartJob")
  )
  if (enqueueFailure) {
    await deleteOrphanWorksheet(supabase, worksheetId)
    return enqueueFailure
  }

  const jobId = parseRpcSuccessStringField(jobData, "jobId")
  if (!jobId) {
    await deleteOrphanWorksheet(supabase, worksheetId)
    return localizedFailure("UNKNOWN", "couldNotStartJob")
  }

  try {
    await sendGenerationJobEvent({
      jobId,
      worksheetId,
      profileId: profile.id,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("couldNotStartBackground")
    await deleteOrphanWorksheet(supabase, worksheetId)
    return failure("UNKNOWN", message)
  }

  revalidatePath("/generate")
  return { ok: true, data: { jobId, worksheetId } }
}

export async function startAppendGenerationJobAction(
  input: z.infer<typeof appendJobInputSchema>
): Promise<
  ActionResult<{ jobId: string; worksheetId: string; newQuestionCount: number }>
> {
  const parsed = appendJobInputSchema.safeParse(input)
  const t = await getTranslations("errors")

  if (!parsed.success) {
    return localizedFailure("VALIDATION_FAILED", "invalidAppendCount")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return localizedFailure("NOT_AUTHENTICATED", "notAuthenticatedAppend")
  }

  const profile = await getProfileForAuthUser(supabase, user.id)

  if (!profile) {
    return localizedFailure("PROFILE_NOT_FOUND")
  }

  const { data: appendData, error: appendError } = await supabase.rpc(
    "extend_worksheet_and_enqueue_job",
    {
      p_worksheet_id: parsed.data.worksheetId,
      p_additional_count: parsed.data.additionalCount,
    }
  )

  const appendFailure = parseRpcActionFailure<{
    jobId: string
    worksheetId: string
    newQuestionCount: number
  }>(appendData, appendError, t("couldNotStartAppendJob"))
  if (appendFailure) {
    return appendFailure
  }

  const newQuestionCount = parseRpcSuccessNumberField(appendData, "questionCount")
  if (newQuestionCount === null) {
    return localizedFailure("UNKNOWN", "couldNotExtendWorksheet")
  }

  const jobId = parseRpcSuccessStringField(appendData, "jobId")
  if (!jobId) {
    return localizedFailure("UNKNOWN", "couldNotStartAppendJob")
  }

  try {
    await sendGenerationJobEvent({
      jobId,
      worksheetId: parsed.data.worksheetId,
      profileId: profile.id,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("couldNotStartBackground")
    await markGenerationJobFailed(jobId, profile.id, message)
    return failure("UNKNOWN", message)
  }

  revalidatePath("/generate")
  return {
    ok: true,
    data: { jobId, worksheetId: parsed.data.worksheetId, newQuestionCount },
  }
}

export async function getGenerationJobAction(
  jobId: string
): Promise<ActionResult<ReturnType<typeof mapGenerationJobPoll>>> {
  const parsed = jobIdSchema.safeParse(jobId)

  if (!parsed.success) {
    return localizedFailure("VALIDATION_FAILED", "invalidGenerationJob")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return localizedFailure("NOT_AUTHENTICATED", "notAuthenticatedProgress")
  }

  const { data: job, error: jobError } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("id", parsed.data)
    .single<GenerationJobRow>()

  if (jobError || !job) {
    return localizedFailure("UNKNOWN", "generationJobNotFound")
  }

  const statusParsed = generationJobStatusSchema.safeParse(job.status)

  if (!statusParsed.success) {
    return localizedFailure("UNKNOWN", "generationJobInvalid")
  }

  const { data: worksheet, error: worksheetError } = await supabase
    .from("worksheets")
    .select("id, question_count")
    .eq("id", job.worksheet_id)
    .single()

  if (worksheetError || !worksheet) {
    return localizedFailure("WORKSHEET_ACCESS_DENIED", "worksheetNotFound")
  }

  const profile = await getProfileForAuthUser(supabase, user.id)

  const questions = await fetchWorksheetQuestions(supabase, worksheet.id)

  if (questions === null) {
    return localizedFailure("QUESTIONS_LOAD_FAILED")
  }

  const poll = mapGenerationJobPoll({
    job,
    questions,
    questionCount: worksheet.question_count,
    creditBalance: profile?.credit_balance ?? null,
  })

  return { ok: true, data: poll }
}

export async function getActiveGenerationJobForWorksheetAction(
  worksheetId: string
): Promise<ActionResult<{ jobId: string } | null>> {
  const parsed = worksheetIdSchema.safeParse(worksheetId)

  if (!parsed.success) {
    return localizedFailure("VALIDATION_FAILED", "invalidWorksheet")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return localizedFailure("NOT_AUTHENTICATED")
  }

  const { data: jobs, error } = await supabase
    .from("generation_jobs")
    .select("id")
    .eq("worksheet_id", parsed.data)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) {
    return localizedFailure("UNKNOWN", "couldNotLoadJob")
  }

  const jobId = jobs?.[0]?.id

  return { ok: true, data: jobId ? { jobId } : null }
}

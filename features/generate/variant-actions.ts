"use server"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { z } from "zod"

import { inngest } from "@/lib/inngest/client"
import { runGenerationJobWorker } from "@/lib/inngest/run-generation-job-worker"
import { localizedFailure } from "@/lib/i18n/server-errors"
import { createClient } from "@/lib/supabase/server"

import {
  failure,
  parseRpcFailure,
  parseStructuredRpcFailure,
} from "./errors"
import {
  type GenerationJobRow,
  generationJobStatusSchema,
} from "./generation-job-types"
import type { ActionResult } from "./result-types"
import { variantLabelSchema, variantQuestionRollSchema, worksheetVariantsPayloadSchema } from "./schemas"
import type { VariantLabel, WorksheetVariant } from "./types"
import { fetchWorksheetQuestions } from "./utils/fetch-worksheet-questions"
import { mapGenerationJobPoll } from "./utils/map-generation-job-poll"
import { allocateVariantLabels } from "@/features/worksheet/utils/merge-variant-questions"

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
  const { createServiceRoleClient } = await import("@/lib/supabase/admin")
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

const startVariantJobInputSchema = z.object({
  worksheetId: z.string().uuid(),
  labels: z.array(variantLabelSchema).min(1).max(3),
})

const saveVariantsInputSchema = z.object({
  worksheetId: z.string().uuid(),
  variants: z
    .array(
      z.object({
        id: z.string().uuid(),
        label: variantLabelSchema,
        createdAt: z.string().min(1),
        rolls: z.array(variantQuestionRollSchema).min(1),
      })
    )
    .min(1)
    .max(3),
})

const jobIdSchema = z.string().uuid()

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

export async function startVariantGenerationJobAction(input: {
  worksheetId: string
  additionalCount: number
}): Promise<ActionResult<{ jobId: string; worksheetId: string; labels: VariantLabel[] }>> {
  const parsedCount = z.number().int().min(1).max(3).safeParse(input.additionalCount)
  const t = await getTranslations("errors")

  if (!parsedCount.success) {
    return localizedFailure("VALIDATION_FAILED", "invalidVariantCount")
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

  const { data: worksheet, error: worksheetError } = await supabase
    .from("worksheets")
    .select("variants")
    .eq("id", input.worksheetId)
    .single<{ variants: unknown }>()

  if (worksheetError || !worksheet) {
    return localizedFailure("WORKSHEET_ACCESS_DENIED", "worksheetNotFound")
  }

  const variantsPayload = worksheetVariantsPayloadSchema.safeParse(worksheet.variants)
  const usedLabels = variantsPayload.success
    ? variantsPayload.data.saved.map((variant) => variant.label)
    : []

  const labels = allocateVariantLabels(parsedCount.data, usedLabels)

  if (!labels) {
    return localizedFailure("VALIDATION_FAILED", "invalidVariantCount")
  }

  const parsed = startVariantJobInputSchema.safeParse({
    worksheetId: input.worksheetId,
    labels,
  })

  if (!parsed.success) {
    return localizedFailure("VALIDATION_FAILED", "invalidWorksheet")
  }

  const { data: jobData, error: enqueueError } = await supabase.rpc(
    "enqueue_variant_generation_job",
    {
      p_worksheet_id: parsed.data.worksheetId,
      p_variant_labels: parsed.data.labels,
    }
  )

  if (enqueueError) {
    const message =
      enqueueError.message.includes("fully generated")
        ? t("worksheetIncompleteForVariants")
        : enqueueError.message.includes("already active")
          ? t("generationJobAlreadyActive")
          : t("couldNotStartVariantJob")

    return failure("UNKNOWN", message)
  }

  const jobId = typeof jobData === "string" ? jobData : null

  if (!jobId) {
    return localizedFailure("UNKNOWN", "couldNotStartVariantJob")
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
  revalidatePath(`/library/${parsed.data.worksheetId}`)
  return {
    ok: true,
    data: { jobId, worksheetId: parsed.data.worksheetId, labels: parsed.data.labels },
  }
}

export async function getVariantGenerationJobAction(
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

  if (jobError || !job || job.kind !== "variant") {
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

export async function saveWorksheetVariantsAction(input: {
  worksheetId: string
  variants: WorksheetVariant[]
}): Promise<ActionResult<null>> {
  const parsed = saveVariantsInputSchema.safeParse(input)
  const t = await getTranslations("errors")

  if (!parsed.success) {
    return localizedFailure("VALIDATION_FAILED", "invalidVariantPayload")
  }

  const payload = worksheetVariantsPayloadSchema.safeParse({ saved: input.variants })

  if (!payload.success) {
    return localizedFailure("VALIDATION_FAILED", "invalidVariantPayload")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return localizedFailure("NOT_AUTHENTICATED")
  }

  const { data, error } = await supabase.rpc("save_worksheet_variants", {
    p_worksheet_id: parsed.data.worksheetId,
    p_variants: payload.data,
  })

  const saveFailure = parseRpcActionFailure<null>(data, error, t("couldNotSaveVariants"))
  if (saveFailure) {
    return saveFailure
  }

  revalidatePath("/library")
  revalidatePath(`/library/${parsed.data.worksheetId}`)
  revalidatePath("/generate")

  return { ok: true, data: null }
}

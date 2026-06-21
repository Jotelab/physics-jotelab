import { generateVariantRollForQuestion } from "@/features/generate/generate-variant-core"
import {
  loadWorksheetQuestionsForProfile,
} from "@/features/generate/generate-question-core"
import type { GenerationJobRow } from "@/features/generate/generation-job-types"
import {
  parseVariantResults,
  parseVariantSkippedOrders,
} from "@/features/generate/generation-job-types"
import type { VariantLabel, VariantQuestionRoll, WorksheetVariant } from "@/features/generate/types"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { createClientForProfile } from "@/lib/supabase/user-client"

import type { GenerationJobStep } from "@/lib/inngest/generation-job-step"
import { syncGenerationJobStep } from "@/lib/inngest/generation-job-step"

type VariantSkippedSlot = {
  order: number
  label: VariantLabel
  message: string
}

async function updateVariantJob(
  admin: ReturnType<typeof createServiceRoleClient>,
  params: {
    jobId: string
    status: GenerationJobRow["status"]
    lastCompletedOrder?: number
    skippedOrders?: VariantSkippedSlot[]
    errorMessage?: string | null
    inngestRunId?: string
    variantResults?: { variants: WorksheetVariant[] }
  }
) {
  const { error } = await admin.rpc("update_generation_job_progress", {
    p_job_id: params.jobId,
    p_status: params.status,
    p_last_completed_order: params.lastCompletedOrder ?? null,
    p_skipped_orders: params.skippedOrders ?? null,
    p_error_message: params.errorMessage ?? null,
    p_inngest_run_id: params.inngestRunId ?? null,
    p_variant_results: params.variantResults ?? null,
  })

  if (error) {
    throw new Error(error.message)
  }
}

function getOrCreateVariant(
  variants: WorksheetVariant[],
  label: VariantLabel
): WorksheetVariant {
  const existing = variants.find((variant) => variant.label === label)
  if (existing) {
    return existing
  }

  const created: WorksheetVariant = {
    id: crypto.randomUUID(),
    label,
    createdAt: new Date().toISOString(),
    rolls: [],
  }
  variants.push(created)
  return created
}

function upsertRoll(variant: WorksheetVariant, roll: VariantQuestionRoll) {
  const index = variant.rolls.findIndex((entry) => entry.order === roll.order)
  if (index >= 0) {
    variant.rolls[index] = roll
  } else {
    variant.rolls.push(roll)
  }
  variant.rolls.sort((a, b) => a.order - b.order)
}

export async function runVariantGenerationJobWorker(params: {
  jobId: string
  worksheetId: string
  profileId: string
  runId?: string
  step?: GenerationJobStep
}) {
  const { jobId, worksheetId, profileId, runId, step = syncGenerationJobStep } = params
  const admin = createServiceRoleClient()

  await step.run("mark-running", async () => {
    await updateVariantJob(admin, {
      jobId,
      status: "running",
      inngestRunId: runId,
    })
  })

  const job = await step.run("load-job", async () => {
    const { data, error } = await admin
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .single<GenerationJobRow>()

    if (error || !data || data.kind !== "variant" || !data.variant_labels?.length) {
      throw new Error("Variant generation job not found")
    }

    return data
  })

  let skippedOrders = parseVariantSkippedOrders(job.skipped_orders)
  let lastCompletedOrder = job.last_completed_order ?? 0
  let variants = parseVariantResults(job.variant_results)
  let terminalStatus: GenerationJobRow["status"] | null = null

  const labels = job.variant_labels ?? []
  const totalRolls = labels.length * job.to_order
  const workItems: { label: VariantLabel; order: number }[] = []

  for (const label of labels) {
    for (let order = job.from_order; order <= job.to_order; order += 1) {
      const variant = variants.find((entry) => entry.label === label)
      const alreadyRolled = variant?.rolls.some((roll) => roll.order === order)
      if (!alreadyRolled) {
        workItems.push({ label, order })
      }
    }
  }

  const loaded = await step.run("load-worksheet", async () => {
    const userClient = await createClientForProfile(profileId)
    return loadWorksheetQuestionsForProfile(userClient, worksheetId, profileId)
  })

  if (!loaded) {
    await step.run("fail-missing-worksheet", async () => {
      await updateVariantJob(admin, {
        jobId,
        status: "failed",
        errorMessage: "Worksheet not found",
        skippedOrders,
        lastCompletedOrder,
        variantResults: { variants },
      })
    })
    return { status: "failed" as const }
  }

  for (const { label, order } of workItems) {
    if (terminalStatus) {
      break
    }

    const stepResult = await step.run(`variant-${label}-${order}`, async () => {
      const userClient = await createClientForProfile(profileId)
      const result = await generateVariantRollForQuestion({
        supabase: userClient,
        profileId,
        worksheetId,
        label,
        order,
      })

      if (result.ok) {
        return {
          type: "saved" as const,
          label,
          order,
          roll: result.data.roll,
          creditBalance: result.data.creditBalance,
        }
      }

      if (result.code === "INSUFFICIENT_CREDITS") {
        return { type: "credits" as const }
      }

      return {
        type: "skipped" as const,
        label,
        order,
        message: result.message,
      }
    })

    if (stepResult.type === "saved") {
      const variant = getOrCreateVariant(variants, stepResult.label)
      upsertRoll(variant, stepResult.roll)
      lastCompletedOrder += 1
      skippedOrders = skippedOrders.filter(
        (slot) => !(slot.label === stepResult.label && slot.order === stepResult.order)
      )

      await step.run(`persist-variant-${stepResult.label}-${stepResult.order}`, async () => {
        await updateVariantJob(admin, {
          jobId,
          status: "running",
          lastCompletedOrder,
          skippedOrders,
          variantResults: { variants },
        })
      })
      continue
    }

    if (stepResult.type === "credits") {
      const currentIndex = workItems.findIndex(
        (item) => item.label === label && item.order === order
      )
      const remaining = workItems.slice(currentIndex)

      for (const item of remaining) {
        const alreadySkipped = skippedOrders.some(
          (slot) => slot.label === item.label && slot.order === item.order
        )
        if (!alreadySkipped) {
          skippedOrders.push({
            label: item.label,
            order: item.order,
            message: "Not enough credits.",
          })
        }
      }

      terminalStatus = "partial"
      break
    }

    if (stepResult.type === "skipped") {
      skippedOrders.push({
        label: stepResult.label,
        order: stepResult.order,
        message: stepResult.message,
      })
      continue
    }
  }

  await step.run("finalize-variant", async () => {
    await updateVariantJob(admin, {
      jobId,
      status: terminalStatus ?? "completed",
      lastCompletedOrder,
      skippedOrders,
      variantResults: { variants },
    })
  })

  return {
    status: terminalStatus ?? "completed",
    totalRolls,
    completedRolls: lastCompletedOrder,
    variants,
  }
}

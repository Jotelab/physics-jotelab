import { generateVariantRollForQuestion } from "@/features/generate/generate-variant-core"
import type { GenerationJobRow } from "@/features/generate/generation-job-types"
import {
  parseVariantResults,
  parseVariantSkippedOrders,
} from "@/features/generate/generation-job-types"
import type {
  VariantLabel,
  VariantQuestionRoll,
  VariantSkippedSlot,
  WorksheetVariant,
} from "@/features/generate/types"
import { deriveVariantId } from "@/features/generate/utils/variant-identity"

import { runGenerationJob } from "@/lib/inngest/generation-job-runner"
import type { GenerationJobStep } from "@/lib/inngest/generation-job-step"

// Variant rolls are independent of one another, so fan them out across this many
// concurrent model calls per Inngest batch instead of one-at-a-time. Bounded so a
// single job can't blow the provider rate-limit / DB pool (the function-wide cap
// in generate-worksheet-questions is the outer backstop).
const VARIANT_ROLL_CONCURRENCY = 5

function getOrCreateVariant(
  variants: WorksheetVariant[],
  label: VariantLabel,
  identity: { jobId: string; createdAt: string }
): WorksheetVariant {
  const existing = variants.find((variant) => variant.label === label)
  if (existing) {
    return existing
  }

  // id/createdAt are derived deterministically (not random / wall-clock) so the
  // variant's identity is stable across Inngest replays and retries; otherwise
  // the per-roll persist step and the finalize step could write different ids.
  const created: WorksheetVariant = {
    id: deriveVariantId(identity.jobId, label),
    label,
    createdAt: identity.createdAt,
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

type VariantItem = { label: VariantLabel; order: number }

/**
 * The orders a job covers, inclusive of both ends.
 *
 * Both the work list and the reported total derive from this one function, so
 * they cannot disagree. They previously did: the total was computed as
 * `labels * to_order`, which silently assumes `from_order === 1`. That holds
 * for variant jobs today (`enqueue_variant_generation_job` hardcodes 1) but is
 * not a property of the schema — `generation_jobs` carries a real range, and
 * the standard worker already enqueues partial ones.
 */
function ordersForJob(job: GenerationJobRow): number[] {
  const orders: number[] = []
  for (let order = job.from_order; order <= job.to_order; order += 1) {
    orders.push(order)
  }
  return orders
}

type VariantState = {
  skippedOrders: VariantSkippedSlot[]
  lastCompletedOrder: number
  variants: WorksheetVariant[]
}

type VariantSaved = {
  roll: VariantQuestionRoll
  creditBalance: number
}

type VariantResult = {
  status: GenerationJobRow["status"]
  totalRolls: number
  completedRolls: number
  variants: WorksheetVariant[]
}

export async function runVariantGenerationJobWorker(params: {
  jobId: string
  worksheetId: string
  profileId: string
  runId?: string
  step?: GenerationJobStep
}) {
  const { jobId, worksheetId, profileId, runId, step } = params

  return runGenerationJob<VariantItem, VariantSaved, VariantState, VariantResult>({
    jobId,
    worksheetId,
    profileId,
    runId,
    step,
    config: {
      batchSize: VARIANT_ROLL_CONCURRENCY,
      loadJob: async (admin) => {
        const { data, error } = await admin
          .from("generation_jobs")
          .select("*")
          .eq("id", jobId)
          .single<GenerationJobRow>()

        if (error || !data || data.kind !== "variant" || !data.variant_labels?.length) {
          throw new Error("Variant generation job not found")
        }

        return data
      },
      initState: (job) => ({
        skippedOrders: parseVariantSkippedOrders(job.skipped_orders),
        lastCompletedOrder: job.last_completed_order ?? 0,
        variants: parseVariantResults(job.variant_results),
      }),
      buildWorkItems: (job, _questions, state) => {
        const labels = job.variant_labels ?? []
        const items: VariantItem[] = []

        for (const label of labels) {
          for (const order of ordersForJob(job)) {
            const variant = state.variants.find((entry) => entry.label === label)
            const alreadyRolled = variant?.rolls.some((roll) => roll.order === order)
            if (!alreadyRolled) {
              items.push({ label, order })
            }
          }
        }

        return items
      },
      workStepId: ({ label, order }) => `variant-${label}-${order}`,
      persistStepId: ({ label, order }) => `persist-variant-${label}-${order}`,
      runItem: async ({ item: { label, order }, userClient, worksheet, questions }) => {
        // Masters never change during a variant job — reuse the runner's one
        // load-worksheet read instead of re-fetching per roll.
        const result = await generateVariantRollForQuestion({
          supabase: userClient,
          profileId,
          worksheetId,
          label,
          order,
          knownWorksheet: worksheet,
          knownQuestions: questions,
        })

        if (result.ok) {
          return {
            type: "saved",
            saved: { roll: result.data.roll, creditBalance: result.data.creditBalance },
          }
        }

        if (result.code === "INSUFFICIENT_CREDITS") {
          return { type: "credits" }
        }

        return { type: "skipped", message: result.message }
      },
      onSaved: (item, saved, state, job) => {
        const variant = getOrCreateVariant(state.variants, item.label, {
          jobId: job.id,
          createdAt: job.created_at,
        })
        upsertRoll(variant, saved.roll)
        state.lastCompletedOrder += 1
        state.skippedOrders = state.skippedOrders.filter(
          (slot) => !(slot.label === item.label && slot.order === item.order)
        )
      },
      onCredits: (item, items, state) => {
        const currentIndex = items.findIndex(
          (entry) => entry.label === item.label && entry.order === item.order
        )
        const remaining = items.slice(currentIndex)

        for (const entry of remaining) {
          // A roll that already landed earlier in the same parallel batch must
          // not be marked skipped just because a sibling ran out of credits.
          const alreadyRolled = state.variants
            .find((variant) => variant.label === entry.label)
            ?.rolls.some((roll) => roll.order === entry.order)
          const alreadySkipped = state.skippedOrders.some(
            (slot) => slot.label === entry.label && slot.order === entry.order
          )
          if (!alreadyRolled && !alreadySkipped) {
            state.skippedOrders.push({
              label: entry.label,
              order: entry.order,
              message: "Not enough credits.",
            })
          }
        }
      },
      onSkipped: (item, message, state) => {
        state.skippedOrders.push({ label: item.label, order: item.order, message })
      },
      serializeProgress: (state) => ({
        lastCompletedOrder: state.lastCompletedOrder,
        skippedOrders: state.skippedOrders,
        variantResults: { variants: state.variants },
      }),
      finalizeStepId: "finalize-variant",
      buildResult: (status, state, job) => ({
        status,
        totalRolls: (job.variant_labels?.length ?? 0) * ordersForJob(job).length,
        completedRolls: state.lastCompletedOrder,
        variants: state.variants,
      }),
    },
  })
}

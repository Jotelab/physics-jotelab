import {
  generateQuestionForWorksheet,
  loadWorksheetQuestionsForProfile,
} from "@/features/generate/generate-question-core"
import type { GenerationJobRow } from "@/features/generate/generation-job-types"
import { parseSkippedOrders } from "@/features/generate/generation-job-types"
import type { SkippedSlot, WorksheetQuestion } from "@/features/generate/types"
import { getUnfilledOrders } from "@/features/generate/utils/get-unfilled-orders"
import {
  appendCreditExhaustedSkips,
  buildPreviousQuestionsContext,
  generateQuestionWithRetry,
} from "@/features/generate/utils/generation-order"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runVariantGenerationJobWorker } from "@/lib/inngest/run-variant-generation-job-worker"
import {
  runGenerationJob,
  updateGenerationJobProgress,
} from "@/lib/inngest/generation-job-runner"
import {
  syncGenerationJobStep,
  type GenerationJobStep,
} from "@/lib/inngest/generation-job-step"

/**
 * Best-effort flip of a job to `failed`, used by the Inngest function's
 * `onFailure` handler after all retries are exhausted. Without this, a job that
 * throws unexpectedly stays `running` forever and the
 * `generation_jobs_one_active_per_worksheet` index blocks the worksheet.
 */
export async function markGenerationJobFailed(jobId: string, errorMessage: string) {
  try {
    const admin = createServiceRoleClient()
    await updateGenerationJobProgress(admin, {
      jobId,
      status: "failed",
      errorMessage,
    })
  } catch {
    // Swallow: this is last-ditch cleanup and must not itself throw.
  }
}

export async function runGenerationJobWorker(params: {
  jobId: string
  worksheetId: string
  profileId: string
  runId?: string
  step?: GenerationJobStep
}) {
  const { jobId, worksheetId, runId, step = syncGenerationJobStep } = params
  const admin = createServiceRoleClient()

  // Derive the profile to impersonate from the authoritative job row (loaded via
  // the admin client) rather than trusting `event.data.profileId`. The event
  // field is an unauthenticated input; minting a user-scoped JWT for it would
  // make a privilege-escalation primitive trust a forgeable field. RLS would
  // fail closed today, but the authoritative `user_id` removes the trust on it.
  const job = await step.run("resolve-job-kind", async () => {
    const { data, error } = await admin
      .from("generation_jobs")
      .select("kind, user_id")
      .eq("id", jobId)
      .single<{ kind: GenerationJobRow["kind"]; user_id: string }>()

    if (error || !data) {
      throw new Error("Generation job not found")
    }

    return data
  })

  const profileId = job.user_id

  if (job.kind === "variant") {
    return runVariantGenerationJobWorker({
      jobId,
      worksheetId,
      profileId,
      runId,
      step,
    })
  }

  return runStandardGenerationJobWorker({
    jobId,
    worksheetId,
    profileId,
    runId,
    step,
  })
}

type StandardState = {
  skippedOrders: SkippedSlot[]
  lastCompletedOrder: number
  questions: WorksheetQuestion[]
}

type StandardSaved = {
  questions: WorksheetQuestion[]
  creditBalance: number
}

async function runStandardGenerationJobWorker(params: {
  jobId: string
  worksheetId: string
  profileId: string
  runId?: string
  step?: GenerationJobStep
}) {
  const { jobId, worksheetId, profileId, runId, step } = params

  return runGenerationJob<number, StandardSaved, StandardState, { status: GenerationJobRow["status"] }>({
    jobId,
    worksheetId,
    profileId,
    runId,
    step,
    config: {
      loadJob: async (admin) => {
        const { data, error } = await admin
          .from("generation_jobs")
          .select("*")
          .eq("id", jobId)
          .single<GenerationJobRow>()

        if (error || !data) {
          throw new Error("Generation job not found")
        }

        return data
      },
      initState: (job) => ({
        skippedOrders: parseSkippedOrders(job.skipped_orders),
        lastCompletedOrder: job.last_completed_order ?? 0,
        questions: [],
      }),
      onWorksheetLoaded: (state, questions) => {
        state.questions = questions
      },
      buildWorkItems: (job, questions) =>
        getUnfilledOrders(questions, job.to_order).filter(
          (order) => order >= job.from_order && order <= job.to_order
        ),
      workStepId: (order) => `generate-order-${order}`,
      persistStepId: (order) => `persist-progress-${order}`,
      runItem: async ({ item: order, userClient }) => {
        const fresh = await loadWorksheetQuestionsForProfile(userClient, worksheetId, profileId)

        if (!fresh) {
          return { type: "failed", message: "Worksheet not found" }
        }

        const context = buildPreviousQuestionsContext(fresh.questions, order)

        const result = await generateQuestionWithRetry({
          order,
          previousQuestionsContext: context,
          generateQuestion: (currentOrder, previousQuestionsContext) =>
            generateQuestionForWorksheet({
              supabase: userClient,
              profileId,
              worksheetId,
              order: currentOrder,
              previousQuestionsContext,
            }),
        })

        if (result.ok) {
          const reloaded = await loadWorksheetQuestionsForProfile(
            userClient,
            worksheetId,
            profileId
          )
          return {
            type: "saved",
            saved: {
              questions: reloaded?.questions ?? [...fresh.questions, result.data.question],
              creditBalance: result.data.creditBalance,
            },
          }
        }

        if (result.code === "INSUFFICIENT_CREDITS") {
          return { type: "credits" }
        }

        return { type: "skipped", message: result.message }
      },
      onSaved: (order, saved, state) => {
        state.questions = saved.questions
        state.lastCompletedOrder = Math.max(state.lastCompletedOrder, order)
        state.skippedOrders = state.skippedOrders.filter((slot) => slot.order !== order)
      },
      onCredits: (order, _items, state, job) => {
        state.skippedOrders = [
          ...state.skippedOrders,
          ...appendCreditExhaustedSkips({
            fromOrder: order,
            toOrder: job.to_order,
            questions: state.questions,
            skippedSlots: state.skippedOrders,
          }),
        ]
      },
      onSkipped: (order, message, state) => {
        state.skippedOrders.push({ order, message })
      },
      serializeProgress: (state) => ({
        lastCompletedOrder: state.lastCompletedOrder,
        skippedOrders: state.skippedOrders,
      }),
      finalizeStepId: "finalize",
      buildResult: (status) => ({ status }),
    },
  })
}

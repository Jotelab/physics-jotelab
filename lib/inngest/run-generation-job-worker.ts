import {
  generateQuestionForWorksheet,
  loadWorksheetQuestionsForProfile,
} from "@/features/generate/generate-question-core"
import type { GenerationJobRow } from "@/features/generate/generation-job-types"
import { parseSkippedOrders } from "@/features/generate/generation-job-types"
import { getUnfilledOrders } from "@/features/generate/utils/get-unfilled-orders"
import {
  appendCreditExhaustedSkips,
  buildPreviousQuestionsContext,
  generateQuestionWithRetry,
} from "@/features/generate/utils/generation-order"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { createClientForProfile } from "@/lib/supabase/user-client"

export type GenerationJobStep = {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>
}

export const syncGenerationJobStep: GenerationJobStep = {
  run: async (_name, fn) => fn(),
}

async function updateJob(
  admin: ReturnType<typeof createServiceRoleClient>,
  params: {
    jobId: string
    status: GenerationJobRow["status"]
    lastCompletedOrder?: number
    skippedOrders?: { order: number; message: string }[]
    errorMessage?: string | null
    inngestRunId?: string
  }
) {
  const { error } = await admin.rpc("update_generation_job_progress", {
    p_job_id: params.jobId,
    p_status: params.status,
    p_last_completed_order: params.lastCompletedOrder ?? null,
    p_skipped_orders: params.skippedOrders ?? null,
    p_error_message: params.errorMessage ?? null,
    p_inngest_run_id: params.inngestRunId ?? null,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function runGenerationJobWorker(params: {
  jobId: string
  worksheetId: string
  profileId: string
  runId?: string
  step?: GenerationJobStep
}) {
  const { jobId, worksheetId, profileId, runId, step = syncGenerationJobStep } = params
  const admin = createServiceRoleClient()

  await step.run("mark-running", async () => {
    await updateJob(admin, {
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

    if (error || !data) {
      throw new Error("Generation job not found")
    }

    return data
  })

  let skippedOrders = parseSkippedOrders(job.skipped_orders)
  let lastCompletedOrder = job.last_completed_order ?? 0
  let terminalStatus: GenerationJobRow["status"] | null = null

  const loaded = await step.run("load-worksheet", async () => {
    const userClient = await createClientForProfile(profileId)
    return loadWorksheetQuestionsForProfile(userClient, worksheetId, profileId)
  })

  if (!loaded) {
    await step.run("fail-missing-worksheet", async () => {
      await updateJob(admin, {
        jobId,
        status: "failed",
        errorMessage: "Worksheet not found",
        skippedOrders,
        lastCompletedOrder,
      })
    })
    return { status: "failed" as const }
  }

  let questions = loaded.questions

  const ordersToFill = getUnfilledOrders(questions, job.to_order).filter(
    (order) => order >= job.from_order && order <= job.to_order
  )

  for (const order of ordersToFill) {
    if (terminalStatus) {
      break
    }

    const stepResult = await step.run(`generate-order-${order}`, async () => {
      const userClient = await createClientForProfile(profileId)
      const fresh = await loadWorksheetQuestionsForProfile(userClient, worksheetId, profileId)

      if (!fresh) {
        return { type: "failed" as const, message: "Worksheet not found" }
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
          type: "saved" as const,
          order,
          questions: reloaded?.questions ?? [...fresh.questions, result.data.question],
          creditBalance: result.data.creditBalance,
        }
      }

      if (result.code === "INSUFFICIENT_CREDITS") {
        return { type: "credits" as const }
      }

      return {
        type: "skipped" as const,
        order,
        message: result.message,
      }
    })

    if (stepResult.type === "saved") {
      questions = stepResult.questions
      lastCompletedOrder = Math.max(lastCompletedOrder, order)
      skippedOrders = skippedOrders.filter((slot) => slot.order !== order)

      await step.run(`persist-progress-${order}`, async () => {
        await updateJob(admin, {
          jobId,
          status: "running",
          lastCompletedOrder,
          skippedOrders,
        })
      })
      continue
    }

    if (stepResult.type === "credits") {
      skippedOrders = [
        ...skippedOrders,
        ...appendCreditExhaustedSkips({
          fromOrder: order,
          toOrder: job.to_order,
          questions,
          skippedSlots: skippedOrders,
        }),
      ]

      terminalStatus = "partial"
      break
    }

    if (stepResult.type === "skipped") {
      skippedOrders.push({
        order: stepResult.order,
        message: stepResult.message,
      })
      continue
    }

    if (stepResult.type === "failed") {
      terminalStatus = "failed"
      await step.run("fail-job", async () => {
        await updateJob(admin, {
          jobId,
          status: "failed",
          errorMessage: stepResult.message,
          skippedOrders,
          lastCompletedOrder,
        })
      })
      return { status: "failed" as const }
    }
  }

  await step.run("finalize", async () => {
    await updateJob(admin, {
      jobId,
      status: terminalStatus ?? "completed",
      lastCompletedOrder,
      skippedOrders,
    })
  })

  return { status: terminalStatus ?? "completed" }
}

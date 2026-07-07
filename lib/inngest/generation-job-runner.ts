import type { SupabaseClient } from "@supabase/supabase-js"

import { loadWorksheetQuestionsForProfile } from "@/features/generate/generate-question-core"
import type { GenerationJobRow } from "@/features/generate/generation-job-types"
import type { WorksheetQuestion, WorksheetVariant } from "@/features/generate/types"
import type { OwnedWorksheetRow } from "@/features/generate/utils/load-owned-worksheet"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { createClientForProfile } from "@/lib/supabase/user-client"
import {
  syncGenerationJobStep,
  type GenerationJobStep,
} from "@/lib/inngest/generation-job-step"

type Admin = ReturnType<typeof createServiceRoleClient>
type JobStatus = GenerationJobRow["status"]

/**
 * Single shared wrapper over `update_generation_job_progress`.
 *
 * The 6-arg overload was dropped in migration
 * `20260625000000_drop_duplicate_update_generation_job_progress`, leaving only
 * the 7-arg version. It `coalesce`s a null `p_variant_results`, so standard
 * jobs that don't carry variants leave the column untouched by passing null.
 */
export async function updateGenerationJobProgress(
  admin: Admin,
  params: {
    jobId: string
    status: JobStatus
    lastCompletedOrder?: number
    skippedOrders?: unknown
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

/** Outcome of generating one work item, returned from inside the work step. */
export type ItemOutcome<TSaved> =
  | { type: "saved"; saved: TSaved }
  | { type: "credits" }
  | { type: "skipped"; message: string }
  | { type: "failed"; message: string }

/** Progress fields a worker serializes from its in-memory state for persistence. */
export type JobProgressFields = {
  lastCompletedOrder?: number
  skippedOrders?: unknown
  variantResults?: { variants: WorksheetVariant[] }
}

/**
 * The per-worker pieces that vary between the standard and variant runs. The
 * shared scaffolding (mark-running, load-job, load-worksheet, the per-item loop
 * with terminal-status handling, persist, and finalize) lives in
 * {@link runGenerationJob}.
 */
export type GenerationJobConfig<TItem, TSaved, TState, TResult> = {
  /**
   * How many items to run concurrently per batch. Defaults to 1 (fully
   * sequential) for workers whose items depend on each other (e.g. standard
   * generation, where each order's context is the prior questions). Independent
   * items (variant rolls) set this higher to fan out the model calls.
   */
  batchSize?: number
  /** Fetch + validate the job row inside the `load-job` step (throws on invalid). */
  loadJob: (admin: Admin) => Promise<GenerationJobRow>
  /** Build the initial in-memory progress state from the loaded job. */
  initState: (job: GenerationJobRow) => TState
  /** Seed state from the loaded worksheet questions (the standard run tracks them). */
  onWorksheetLoaded?: (state: TState, questions: WorksheetQuestion[]) => void
  /** Ordered list of per-item work, computed once the worksheet is loaded. */
  buildWorkItems: (
    job: GenerationJobRow,
    questions: WorksheetQuestion[],
    state: TState
  ) => TItem[]
  /** Inngest step id for the work step and the post-save persist step. */
  workStepId: (item: TItem) => string
  persistStepId: (item: TItem) => string
  /**
   * Per-item work, run inside the work step against a user-scoped client.
   * Receives the accumulated `state` (questions generated so far, etc.) plus
   * the worksheet row and questions from the one load-worksheet step, so the
   * work can reuse them instead of re-reading from the DB.
   */
  runItem: (args: {
    item: TItem
    userClient: SupabaseClient
    job: GenerationJobRow
    state: TState
    worksheet: OwnedWorksheetRow
    questions: WorksheetQuestion[]
  }) => Promise<ItemOutcome<TSaved>>
  /** Mutate state for each terminal outcome of an item. */
  onSaved: (item: TItem, saved: TSaved, state: TState, job: GenerationJobRow) => void
  onCredits: (item: TItem, items: TItem[], state: TState, job: GenerationJobRow) => void
  onSkipped: (item: TItem, message: string, state: TState) => void
  /** Serialize state into the progress-update payload (persist / finalize / fail). */
  serializeProgress: (state: TState) => JobProgressFields
  /** Inngest step id for the terminal finalize step. */
  finalizeStepId: string
  /** Build the worker's finalize return value. */
  buildResult: (status: JobStatus, state: TState, job: GenerationJobRow) => TResult
}

/**
 * Drives a generation job through the shared lifecycle, deferring the variable
 * parts (job validation, work list, per-item work, progress serialization) to
 * the provided {@link GenerationJobConfig}. Both the standard question worker
 * and the variant roll worker are thin configs over this runner.
 */
export async function runGenerationJob<TItem, TSaved, TState, TResult>(params: {
  jobId: string
  worksheetId: string
  profileId: string
  runId?: string
  step?: GenerationJobStep
  config: GenerationJobConfig<TItem, TSaved, TState, TResult>
}): Promise<TResult | { status: "failed" }> {
  const {
    jobId,
    worksheetId,
    profileId,
    runId,
    step = syncGenerationJobStep,
    config,
  } = params
  const admin = createServiceRoleClient()

  await step.run("mark-running", async () => {
    await updateGenerationJobProgress(admin, {
      jobId,
      status: "running",
      inngestRunId: runId,
    })
  })

  const job = await step.run("load-job", () => config.loadJob(admin))

  const state = config.initState(job)
  let terminalStatus: JobStatus | null = null

  const loaded = await step.run("load-worksheet", async () => {
    const userClient = await createClientForProfile(profileId)
    // Prompt-context read only — never pay the WASM TeX diagram compiles here.
    return loadWorksheetQuestionsForProfile(userClient, worksheetId, profileId, {
      attachDiagrams: false,
    })
  })

  if (!loaded) {
    await step.run("fail-missing-worksheet", async () => {
      await updateGenerationJobProgress(admin, {
        jobId,
        status: "failed",
        errorMessage: "Worksheet not found",
        ...config.serializeProgress(state),
      })
    })
    return { status: "failed" as const }
  }

  config.onWorksheetLoaded?.(state, loaded.questions)

  const items = config.buildWorkItems(job, loaded.questions, state)
  const batchSize = Math.max(1, config.batchSize ?? 1)

  for (let start = 0; start < items.length && !terminalStatus; start += batchSize) {
    const batch = items.slice(start, start + batchSize)

    // Run the per-item work concurrently. Independent items (e.g. variant rolls)
    // finish in parallel; a sequential worker just uses batchSize 1. Inngest
    // memoizes each step by id, so Promise.all is replay-safe.
    const outcomes = await Promise.all(
      batch.map((item) =>
        step.run(config.workStepId(item), async () => {
          const userClient = await createClientForProfile(profileId)
          return config.runItem({
            item,
            userClient,
            job,
            state,
            worksheet: loaded.worksheet,
            questions: loaded.questions,
          })
        })
      )
    )

    // Apply every saved item (and persist) first, so a roll that was generated
    // and charged is never dropped because a sibling in the same batch ran out
    // of credits or failed. State mutations stay sequential and in batch order,
    // keeping replay deterministic.
    for (let i = 0; i < batch.length; i += 1) {
      const outcome = outcomes[i]
      if (outcome.type === "saved") {
        config.onSaved(batch[i], outcome.saved, state, job)

        await step.run(config.persistStepId(batch[i]), async () => {
          await updateGenerationJobProgress(admin, {
            jobId,
            status: "running",
            ...config.serializeProgress(state),
          })
        })
      }
    }

    for (let i = 0; i < batch.length; i += 1) {
      const outcome = outcomes[i]
      if (outcome.type === "skipped") {
        config.onSkipped(batch[i], outcome.message, state)
      }
    }

    const failed = batch
      .map((item, i) => ({ item, outcome: outcomes[i] }))
      .find(({ outcome }) => outcome.type === "failed")

    if (failed && failed.outcome.type === "failed") {
      terminalStatus = "failed"
      const errorMessage = failed.outcome.message
      await step.run("fail-job", async () => {
        await updateGenerationJobProgress(admin, {
          jobId,
          status: "failed",
          errorMessage,
          ...config.serializeProgress(state),
        })
      })
      return { status: "failed" as const }
    }

    const creditItem = batch.find((_, i) => outcomes[i].type === "credits")

    if (creditItem) {
      // Mark the items that did not complete (this batch's credit failures plus
      // every later item) as credit-skipped, then stop.
      config.onCredits(creditItem, items, state, job)
      terminalStatus = "partial"
    }
  }

  await step.run(config.finalizeStepId, async () => {
    await updateGenerationJobProgress(admin, {
      jobId,
      status: terminalStatus ?? "completed",
      ...config.serializeProgress(state),
    })
  })

  return config.buildResult(terminalStatus ?? "completed", state, job)
}

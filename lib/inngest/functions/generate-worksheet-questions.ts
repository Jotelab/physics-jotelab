import {
  markGenerationJobFailed,
  runGenerationJobWorker,
} from "@/lib/inngest/run-generation-job-worker"
import { toGenerationJobStep } from "@/lib/inngest/generation-job-step"

import { inngest } from "../client"

const DEFAULT_GENERATION_CONCURRENCY = 25

/**
 * Function-wide cap on how many worksheet generations run at once. The
 * per-worksheet `concurrency` limit below only serializes a single worksheet;
 * without this global cap a burst of distinct worksheets would fan out into
 * unbounded concurrent model calls and Supabase connections (provider
 * rate-limit / connection-pool exhaustion). Tune via `INNGEST_GENERATION_CONCURRENCY`.
 */
const GENERATION_CONCURRENCY_LIMIT = (() => {
  const raw = Number.parseInt(process.env.INNGEST_GENERATION_CONCURRENCY ?? "", 10)
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_GENERATION_CONCURRENCY
})()

export const generateWorksheetQuestions = inngest.createFunction(
  {
    id: "generate-worksheet-questions",
    triggers: [{ event: "worksheet/generation.requested" }],
    retries: 2,
    concurrency: [
      // Never run two jobs for the same worksheet at once (pairs with the
      // one-active-per-worksheet DB index).
      {
        key: "event.data.worksheetId",
        limit: 1,
      },
      // Bound total concurrent generations function-wide (scope defaults to
      // "fn") so a burst can't exhaust the model rate-limit or the DB pool.
      {
        limit: GENERATION_CONCURRENCY_LIMIT,
      },
    ],
    // Without this, an unexpected throw that exhausts all retries leaves the job
    // row stuck in `running`, and the `one active per worksheet` partial-unique
    // index then blocks every future job for that worksheet permanently.
    onFailure: async ({ event, error }) => {
      const { jobId } = event.data.event.data
      await markGenerationJobFailed(jobId, error.message)
    },
  },
  async ({ event, step, runId }) => {
    const { jobId, worksheetId, profileId } = event.data

    return runGenerationJobWorker({
      jobId,
      worksheetId,
      profileId,
      runId,
      step: toGenerationJobStep(step),
    })
  }
)

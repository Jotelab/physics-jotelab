import {
  markGenerationJobFailed,
  runGenerationJobWorker,
} from "@/lib/inngest/run-generation-job-worker"
import type { GenerationJobStep } from "@/lib/inngest/generation-job-step"

import { inngest } from "../client"

export const generateWorksheetQuestions = inngest.createFunction(
  {
    id: "generate-worksheet-questions",
    triggers: [{ event: "worksheet/generation.requested" }],
    retries: 2,
    concurrency: {
      key: "event.data.worksheetId",
      limit: 1,
    },
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
      step: step as unknown as GenerationJobStep,
    })
  }
)

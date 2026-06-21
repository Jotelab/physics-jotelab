import {
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

import { toGenerationJobStep } from "@/lib/inngest/generation-job-step"
import { runStaleGenerationSweep } from "@/lib/inngest/run-stale-generation-sweep"

import { inngest } from "../client"

export const sweepStaleGeneration = inngest.createFunction(
  {
    id: "sweep-stale-generation",
    // Every 15 minutes: refund expired credit reservations and reap generation
    // jobs whose Inngest run died without marking the job failed.
    triggers: [{ cron: "*/15 * * * *" }],
    retries: 1,
  },
  async ({ step }) => runStaleGenerationSweep(toGenerationJobStep(step))
)

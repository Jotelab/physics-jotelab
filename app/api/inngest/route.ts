import { serve } from "inngest/next"

import { inngest } from "@/lib/inngest/client"
import { generateWorksheetQuestions } from "@/lib/inngest/functions/generate-worksheet-questions"
import { sweepStaleGeneration } from "@/lib/inngest/functions/sweep-stale-generation"

// Signing-key pinning, production fail-fast, and dev-mode handling live on the
// `inngest` client (see lib/inngest/client.ts); the serve handler inherits them.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateWorksheetQuestions, sweepStaleGeneration],
})

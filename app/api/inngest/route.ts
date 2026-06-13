import { serve } from "inngest/next"

import { inngest } from "@/lib/inngest/client"
import { generateWorksheetQuestions } from "@/lib/inngest/functions/generate-worksheet-questions"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateWorksheetQuestions],
})

import { serve } from "inngest/next"

import { inngest } from "@/lib/inngest/client"
import { generateWorksheetQuestions } from "@/lib/inngest/functions/generate-worksheet-questions"

const isProduction = process.env.NODE_ENV === "production"
const signingKey = process.env.INNGEST_SIGNING_KEY

// Fail fast at boot rather than serving an unverified endpoint: without a signing
// key, Inngest can fall back to dev mode and skip request-signature verification,
// which would let anyone POST to /api/inngest to mint user-scoped JWTs and spend
// credits. Pin `signingKey`/`isDev` explicitly instead of trusting env
// auto-detection.
if (isProduction && !signingKey) {
  throw new Error(
    "INNGEST_SIGNING_KEY is required in production; refusing to serve /api/inngest without request-signature verification."
  )
}

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateWorksheetQuestions],
  signingKey,
  isDev: !isProduction,
})

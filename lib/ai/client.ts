import { google } from "@ai-sdk/google"
import type { LanguageModel } from "ai"

const GENERATION_MODEL_ID = "gemini-2.5-flash"

/** Direct Google API when a key is set; otherwise Vercel AI Gateway (e.g. OIDC on deploy). */
export function getGenerationModel(): LanguageModel {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google(GENERATION_MODEL_ID)
  }

  return `google/${GENERATION_MODEL_ID}`
}

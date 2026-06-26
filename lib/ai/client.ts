/*
# AI generation — provider selection
MODEL_PROVIDER=google          # "google" (default) | "runpod"

# Google provider (default) — direct API key or Vercel AI Gateway
GOOGLE_GENERATIVE_AI_API_KEY=
VERCEL_OIDC_TOKEN=

# RunPod provider — OpenAI-compatible vLLM endpoint
RUNPOD_BASE_URL=
RUNPOD_API_KEY=
RUNPOD_MODEL_ID=
*/

import "server-only"

import { google } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

const GENERATION_MODEL_ID = "gemini-2.5-flash"

/** Direct Google API when a key is set; otherwise Vercel AI Gateway (e.g. OIDC on deploy). */
function getGoogleModel(): LanguageModel {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google(GENERATION_MODEL_ID)
  }

  return `google/${GENERATION_MODEL_ID}`
}

function getRunpodModel(): LanguageModel {
  const baseURL = process.env.RUNPOD_BASE_URL
  const apiKey = process.env.RUNPOD_API_KEY
  const modelId = process.env.RUNPOD_MODEL_ID

  if (!baseURL || !apiKey || !modelId) {
    throw new Error(
      "RunPod provider requires RUNPOD_BASE_URL, RUNPOD_API_KEY, and RUNPOD_MODEL_ID"
    )
  }

  const runpod = createOpenAI({
    baseURL,
    apiKey,
  })

  return runpod(modelId)
}

export function getGenerationModel(): LanguageModel {
  const provider = process.env.MODEL_PROVIDER ?? "google"

  switch (provider) {
    case "google":
      return getGoogleModel()
    case "runpod":
      return getRunpodModel()
    default:
      throw new Error(`Unknown MODEL_PROVIDER: ${provider}`)
  }
}

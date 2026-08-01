/*
# AI generation — provider selection
MODEL_PROVIDER=google          # "google" (default) | "runpod"

# Google provider (default) — direct API key or Vercel AI Gateway
GOOGLE_GENERATIVE_AI_API_KEY=
VERCEL_OIDC_TOKEN=
GENERATION_MODEL_ID=            # optional override of the pinned Gemini model

# RunPod provider — OpenAI-compatible vLLM endpoint
RUNPOD_BASE_URL=
RUNPOD_API_KEY=
RUNPOD_MODEL_ID=
*/

import "server-only"

import { google } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

/**
 * Pinned generation model.
 *
 * Google retires model ids without notice — a retired id fails *every*
 * generation with a 404 ("no longer available to new users"), so this is pinned
 * to a currently-served id and overridable via `GENERATION_MODEL_ID` so an
 * outage can be mitigated with an env change instead of a deploy.
 *
 * `gemini-3.6-flash` and `gemini-flash-latest` are deliberately *not* used: on
 * the variant prompt (which asks the model to echo the master question's LaTeX)
 * they intermittently append junk continuations to `solution.steps` — unrelated
 * prose in mixed languages that still satisfies the schema and would ship to a
 * student. `gemini-3.5-flash` did not reproduce that in repeated live runs.
 */
const DEFAULT_GENERATION_MODEL_ID = "gemini-3.5-flash"

function generationModelId(): string {
  return process.env.GENERATION_MODEL_ID || DEFAULT_GENERATION_MODEL_ID
}

/** Direct Google API when a key is set; otherwise Vercel AI Gateway (e.g. OIDC on deploy). */
function getGoogleModel(): LanguageModel {
  const modelId = generationModelId()

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google(modelId)
  }

  return `google/${modelId}`
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

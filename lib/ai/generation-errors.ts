import {
  APICallError,
  LoadAPIKeyError,
  TypeValidationError,
} from "ai"
import { z } from "zod"

import { failure, type AppFailure, type GenerationErrorCode } from "@/features/generate/errors"
import { EngineError } from "@/lib/engine/client"

const DEFAULT_GENERATION_MESSAGE = "We could not generate the question."
const DEFAULT_REGENERATE_MESSAGE = "Could not regenerate the question. No credits were spent."

export function logGenerationError(context: string, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.error(`[${context}]`, error)
  }
}

export function getGenerationErrorMessage(
  error: unknown,
  fallback = DEFAULT_GENERATION_MESSAGE
): string {
  return getGenerationFailure(error, "GENERATE_FAILED", fallback).message
}

export function getRegenerateErrorMessage(error: unknown): string {
  return getGenerationFailure(error, "REGENERATE_FAILED", DEFAULT_REGENERATE_MESSAGE).message
}

export function getGenerationFailure(
  error: unknown,
  fallbackCode: GenerationErrorCode = "GENERATE_FAILED",
  fallbackMessage = DEFAULT_GENERATION_MESSAGE
): AppFailure {
  // Engine failures get their own code (not the fallback) so the client can
  // localize them and the user learns the credit came back — never the raw
  // "Could not reach the symbolic engine: fetch failed" internals.
  if (error instanceof EngineError) {
    return failure("ENGINE_UNAVAILABLE")
  }

  if (error instanceof LoadAPIKeyError) {
    return failure(fallbackCode, "Google AI API key is missing or invalid.")
  }

  if (error instanceof APICallError) {
    const status = error.statusCode

    if (status === 401 || status === 403) {
      return failure(
        fallbackCode,
        "Google AI rejected the request. Check your API key and that the Generative Language API is enabled."
      )
    }

    if (status === 429) {
      return failure(
        fallbackCode,
        "Google AI rate limit reached. Please wait a moment and try again."
      )
    }

    if (error.message) {
      return failure(fallbackCode, error.message)
    }
  }

  if (error instanceof TypeValidationError || error instanceof z.ZodError) {
    return failure(fallbackCode, "AI returned an invalid question shape. Please try again.")
  }

  if (error instanceof Error && error.message) {
    return failure(fallbackCode, error.message)
  }

  return failure(fallbackCode, fallbackMessage)
}

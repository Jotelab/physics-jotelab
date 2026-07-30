import { z } from "zod"

export const GENERATION_ERROR_CODES = [
  "INSUFFICIENT_CREDITS",
  "WORKSHEET_ACCESS_DENIED",
  "WORKSHEET_ALREADY_COMPLETE",
  "SLOT_ALREADY_RESERVED",
  "GENERATION_SETTINGS_MISSING",
  "QUESTION_NOT_FOUND",
  "QUESTIONS_LOAD_FAILED",
  "CREDIT_BALANCE_UNAVAILABLE",
  "RESERVATION_EXPIRED",
  "RESERVATION_NOT_FOUND",
  "INVALID_QUESTION",
  "PROFILE_NOT_FOUND",
  "NOT_AUTHENTICATED",
  "VALIDATION_FAILED",
  "ENGINE_UNAVAILABLE",
  "GENERATE_FAILED",
  "REGENERATE_FAILED",
  "VARIANT_FAILED",
  "SAVE_FAILED",
  "RESERVE_FAILED",
  "UNKNOWN",
] as const

export type GenerationErrorCode = (typeof GENERATION_ERROR_CODES)[number]

export const GENERATION_ERROR_MESSAGES: Record<GenerationErrorCode, string> = {
  INSUFFICIENT_CREDITS: "You do not have enough credits.",
  WORKSHEET_ACCESS_DENIED: "You do not have access to this worksheet.",
  WORKSHEET_ALREADY_COMPLETE: "This worksheet is already complete.",
  SLOT_ALREADY_RESERVED: "This question slot is already being generated or is complete.",
  GENERATION_SETTINGS_MISSING: "Worksheet generation settings are missing.",
  QUESTION_NOT_FOUND: "Question not found.",
  QUESTIONS_LOAD_FAILED: "Worksheet questions could not be loaded.",
  CREDIT_BALANCE_UNAVAILABLE: "Could not load your credit balance.",
  RESERVATION_EXPIRED: "Your generation session expired. Please try again.",
  RESERVATION_NOT_FOUND: "Could not complete the generation request. Please try again.",
  INVALID_QUESTION: "The generated question did not pass validation and could not be saved.",
  PROFILE_NOT_FOUND: "Profile not found.",
  NOT_AUTHENTICATED: "You must be logged in.",
  VALIDATION_FAILED: "Please check your input and try again.",
  ENGINE_UNAVAILABLE:
    "The calculation engine could not be reached. Your credit has been refunded — please try again.",
  GENERATE_FAILED: "We could not generate the question.",
  REGENERATE_FAILED: "Could not regenerate the question. No credits were spent.",
  VARIANT_FAILED: "Could not generate the variant. No credits were spent.",
  SAVE_FAILED: "Could not save the generated question.",
  RESERVE_FAILED: "Could not reserve a credit for this question.",
  UNKNOWN: "Something went wrong. Please try again.",
}

const RETRYABLE_CODES = new Set<GenerationErrorCode>([
  "UNKNOWN",
  // A transient network blip to the engine deserves one more attempt; a real
  // outage fails the retry too and the slot surfaces ENGINE_UNAVAILABLE.
  "ENGINE_UNAVAILABLE",
  "GENERATE_FAILED",
  "VARIANT_FAILED",
  "SAVE_FAILED",
  "RESERVE_FAILED",
])

const generationErrorCodeSchema = z.enum(GENERATION_ERROR_CODES)

export type AppFailure = { ok: false; code: GenerationErrorCode; message: string }

export function failure(code: GenerationErrorCode, message?: string): AppFailure {
  return {
    ok: false,
    code,
    message: message ?? GENERATION_ERROR_MESSAGES[code],
  }
}

export function isRetryableCode(code: GenerationErrorCode): boolean {
  return RETRYABLE_CODES.has(code)
}

export function parseGenerationErrorCode(raw: unknown): GenerationErrorCode | null {
  const parsed = generationErrorCodeSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function mapLegacyRpcMessage(raw: string): GenerationErrorCode {
  const message = raw.trim()

  if (!message) {
    return "UNKNOWN"
  }

  if (message.includes("Insufficient credits")) {
    return "INSUFFICIENT_CREDITS"
  }

  if (message.includes("Slot already reserved")) {
    return "SLOT_ALREADY_RESERVED"
  }

  if (message.includes("Worksheet or question not found")) {
    return "QUESTION_NOT_FOUND"
  }

  if (message.includes("already complete")) {
    return "WORKSHEET_ALREADY_COMPLETE"
  }

  if (message.includes("Reservation expired")) {
    return "RESERVATION_EXPIRED"
  }

  if (message.includes("Reservation not found")) {
    return "RESERVATION_NOT_FOUND"
  }

  if (message.includes("Profile not found")) {
    return "PROFILE_NOT_FOUND"
  }

  if (message.includes("Invalid worksheet question")) {
    return "INVALID_QUESTION"
  }

  if (message.includes("Worksheet not found")) {
    return "WORKSHEET_ACCESS_DENIED"
  }

  if (message.includes("Not authenticated") || message.startsWith("You must be logged in")) {
    return "NOT_AUTHENTICATED"
  }

  return "UNKNOWN"
}

function rpcDisplayMessage(code: GenerationErrorCode, rawMessage: string): string {
  if (!rawMessage) {
    return GENERATION_ERROR_MESSAGES[code]
  }

  if (mapLegacyRpcMessage(rawMessage) === code) {
    return GENERATION_ERROR_MESSAGES[code]
  }

  return rawMessage
}

export function resolveStructuredFailure(
  body: { code?: unknown; message?: string },
  fallbackCode: GenerationErrorCode,
  fallbackMessage?: string
): AppFailure {
  const rawMessage = typeof body.message === "string" ? body.message.trim() : ""
  const explicitCode = parseGenerationErrorCode(body.code)
  const code = explicitCode ?? (rawMessage ? mapLegacyRpcMessage(rawMessage) : fallbackCode)

  if (explicitCode) {
    return failure(explicitCode, rpcDisplayMessage(explicitCode, rawMessage))
  }

  if (code !== "UNKNOWN") {
    return failure(code)
  }

  return failure(fallbackCode, fallbackMessage)
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message)
  }

  return ""
}

export function parseStructuredRpcFailure(
  body: unknown,
  fallbackCode: GenerationErrorCode,
  fallbackMessage?: string
): AppFailure | null {
  if (typeof body !== "object" || body === null || !("success" in body)) {
    return null
  }

  if (body.success !== false) {
    return null
  }

  return resolveStructuredFailure(
    {
      code: "code" in body ? body.code : undefined,
      message: "message" in body && typeof body.message === "string" ? body.message : undefined,
    },
    fallbackCode,
    fallbackMessage
  )
}

export function parseRpcFailure(
  error: unknown,
  fallbackCode: GenerationErrorCode,
  fallbackMessage?: string
): AppFailure {
  if (
    typeof error === "object" &&
    error !== null &&
    "ok" in error &&
    error.ok === false &&
    "code" in error &&
    "message" in error
  ) {
    return error as AppFailure
  }

  const structured = parseStructuredRpcFailure(error, fallbackCode, fallbackMessage)

  if (structured) {
    return structured
  }

  const message = extractErrorMessage(error).trim()

  if (message) {
    const code = mapLegacyRpcMessage(message)

    if (code === "UNKNOWN") {
      return failure(fallbackCode, fallbackMessage ?? GENERATION_ERROR_MESSAGES[fallbackCode])
    }

    return failure(code)
  }

  return failure(fallbackCode, fallbackMessage)
}

export function parseRpcSuccessStringField(data: unknown, field: string): string | null {
  if (typeof data === "object" && data !== null && "success" in data && data.success === true) {
    const value = (data as Record<string, unknown>)[field]
    return typeof value === "string" ? value : null
  }

  return typeof data === "string" ? data : null
}

export function parseRpcSuccessNumberField(data: unknown, field: string): number | null {
  if (typeof data === "object" && data !== null && "success" in data && data.success === true) {
    const value = (data as Record<string, unknown>)[field]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
    return null
  }

  if (typeof data === "number" && Number.isFinite(data)) {
    return data
  }

  return null
}

export function parseRpcSuccessObjectField(data: unknown, field: string): unknown {
  if (typeof data === "object" && data !== null && "success" in data && data.success === true) {
    return (data as Record<string, unknown>)[field] ?? null
  }

  return data
}

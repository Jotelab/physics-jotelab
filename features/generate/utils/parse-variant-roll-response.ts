import { resolveStructuredFailure } from "@/features/generate/errors"
import type { AppFailure, GenerationErrorCode } from "@/features/generate/errors"
import { variantQuestionRollSchema } from "@/features/generate/schemas"
import type { VariantQuestionRoll } from "@/features/generate/types"
import { z } from "zod"

import { parseCreditBalance } from "./parse-complete-response"
import { parseCancelResponse, parseReserveEnvelope } from "./parse-reservation-response"

/**
 * Variant-roll flavors of the shared reservation RPC envelope. The reserve and
 * cancel parsers delegate to the generic envelope in
 * `parse-reservation-response.ts` (same protocol, `roll` payload); the complete
 * parser stays local because the variant complete RPC's failure envelope
 * differs from the question one (SAVE_FAILED fallback, no credit balance on
 * failure, optional `success`).
 */

export type ParsedVariantRollReserveResponse =
  | {
      kind: "completed"
      roll: VariantQuestionRoll
      creditBalance: number
    }
  | {
      kind: "reserved"
      reservationId: string
      creditBalance: number
    }
  | {
      kind: "failed"
      code: GenerationErrorCode
      message: string
    }

export function parseVariantRollReserveResponse(
  reserveResult: unknown
): ParsedVariantRollReserveResponse | null {
  const envelope = parseReserveEnvelope(reserveResult, {
    itemKey: "roll",
    itemSchema: variantQuestionRollSchema,
    failureMessage: "Could not reserve a credit for this variant roll.",
  })

  if (envelope === null) {
    return null
  }

  if (envelope.kind === "completed") {
    return {
      kind: "completed",
      roll: envelope.item,
      creditBalance: envelope.creditBalance,
    }
  }

  return envelope
}

const variantRollCompleteResponseSchema = z
  .object({
    success: z.boolean().optional(),
    roll: z.unknown().optional(),
    creditBalance: z.union([z.number(), z.string()]).optional(),
    code: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough()

export function parseVariantRollCompleteResponse(
  completeResult: unknown
): { ok: true; data: { roll: VariantQuestionRoll; creditBalance: number } } | AppFailure {
  const shape = variantRollCompleteResponseSchema.safeParse(completeResult)

  if (!shape.success) {
    return {
      ok: false,
      code: "SAVE_FAILED",
      message: "Invalid complete response.",
    }
  }

  if (shape.data.success === false) {
    return resolveStructuredFailure(
      shape.data,
      "SAVE_FAILED",
      "Could not complete variant roll reservation."
    )
  }

  const creditBalance = parseCreditBalance(shape.data.creditBalance)
  const roll = variantQuestionRollSchema.safeParse(shape.data.roll)

  if (creditBalance === null || !roll.success) {
    return {
      ok: false,
      code: "SAVE_FAILED",
      message: "Invalid complete response.",
    }
  }

  return {
    ok: true,
    data: {
      roll: roll.data,
      creditBalance,
    },
  }
}

/** Same envelope as the question cancel RPC — one parser serves both. */
export const parseVariantRollCancelResponse = parseCancelResponse

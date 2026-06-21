import { z } from "zod"

import { resolveStructuredFailure } from "@/features/generate/errors"
import type { AppFailure, GenerationErrorCode } from "@/features/generate/errors"
import { variantQuestionRollSchema } from "@/features/generate/schemas"
import type { VariantQuestionRoll } from "@/features/generate/types"

import { parseCreditBalance } from "./parse-complete-response"

const variantRollReserveResponseSchema = z
  .object({
    reservationId: z.string().uuid().optional(),
    creditBalance: z.union([z.number(), z.string()]).optional(),
    alreadyCompleted: z.boolean().optional(),
    roll: z.unknown().optional(),
    success: z.boolean().optional(),
    code: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough()

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

const variantRollCompleteResponseSchema = z
  .object({
    success: z.boolean().optional(),
    roll: z.unknown().optional(),
    creditBalance: z.union([z.number(), z.string()]).optional(),
    code: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough()

export function parseVariantRollReserveResponse(
  reserveResult: unknown
): ParsedVariantRollReserveResponse | null {
  const shape = variantRollReserveResponseSchema.safeParse(reserveResult)

  if (!shape.success) {
    return null
  }

  if (shape.data.success === false) {
    const failed = resolveStructuredFailure(
      shape.data,
      "RESERVE_FAILED",
      "Could not reserve a credit for this variant roll."
    )
    return {
      kind: "failed",
      code: failed.code,
      message: failed.message,
    }
  }

  const creditBalance = parseCreditBalance(shape.data.creditBalance)

  if (creditBalance === null) {
    return null
  }

  if (shape.data.alreadyCompleted === true) {
    const roll = variantQuestionRollSchema.safeParse(shape.data.roll)

    if (!roll.success) {
      return null
    }

    return {
      kind: "completed",
      roll: roll.data,
      creditBalance,
    }
  }

  if (!shape.data.reservationId) {
    return null
  }

  return {
    kind: "reserved",
    reservationId: shape.data.reservationId,
    creditBalance,
  }
}

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

export function parseVariantRollCancelResponse(cancelResult: unknown): number | null {
  if (typeof cancelResult !== "object" || cancelResult === null) {
    return null
  }

  return parseCreditBalance("creditBalance" in cancelResult ? cancelResult.creditBalance : null)
}

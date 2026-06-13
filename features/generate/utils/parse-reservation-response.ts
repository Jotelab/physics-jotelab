import { z } from "zod"

import type { GenerationErrorCode } from "@/features/generate/errors"
import { resolveStructuredFailure } from "@/features/generate/errors"
import type { AppFailure } from "@/features/generate/errors"
import { worksheetQuestionSchema } from "@/features/generate/schemas"
import type { WorksheetQuestion } from "@/features/generate/types"

import { parseCreditBalance } from "./parse-complete-response"

const reserveResponseShapeSchema = z
  .object({
    reservationId: z.string().uuid().optional(),
    creditBalance: z.union([z.number(), z.string()]).optional(),
    pendingQuestionId: z.string().uuid().optional(),
    alreadyCompleted: z.boolean().optional(),
    question: z.unknown().optional(),
    success: z.boolean().optional(),
    code: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough()

export type ParsedReserveResponse =
  | {
      kind: "completed"
      question: WorksheetQuestion
      creditBalance: number
    }
  | {
      kind: "reserved"
      reservationId: string
      creditBalance: number
      pendingQuestionId?: string
    }
  | {
      kind: "failed"
      code: GenerationErrorCode
      message: string
    }

function parseReserveFailure(shape: z.infer<typeof reserveResponseShapeSchema>): AppFailure {
  return resolveStructuredFailure(
    shape,
    "RESERVE_FAILED",
    "Could not reserve a credit for this question."
  )
}

export function parseReserveResponse(reserveResult: unknown): ParsedReserveResponse | null {
  const shape = reserveResponseShapeSchema.safeParse(reserveResult)

  if (!shape.success) {
    return null
  }

  if (shape.data.success === false) {
    const failed = parseReserveFailure(shape.data)
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
    const question = worksheetQuestionSchema.safeParse(shape.data.question)

    if (!question.success) {
      return null
    }

    return {
      kind: "completed",
      question: question.data,
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
    ...(shape.data.pendingQuestionId
      ? { pendingQuestionId: shape.data.pendingQuestionId }
      : {}),
  }
}

export function parseCancelResponse(cancelResult: unknown): number | null {
  if (typeof cancelResult !== "object" || cancelResult === null) {
    return null
  }

  const creditBalance = parseCreditBalance(
    "creditBalance" in cancelResult ? cancelResult.creditBalance : null
  )

  return creditBalance
}

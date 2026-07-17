import { z } from "zod"

import type { GenerationErrorCode } from "@/features/generate/errors"
import { resolveStructuredFailure } from "@/features/generate/errors"
import { worksheetQuestionSchema } from "@/features/generate/schemas"
import type { WorksheetQuestion } from "@/features/generate/types"

import { parseCreditBalance } from "./parse-complete-response"

const reserveResponseShapeSchema = z
  .object({
    reservationId: z.string().uuid().optional(),
    creditBalance: z.union([z.number(), z.string()]).optional(),
    pendingQuestionId: z.string().uuid().optional(),
    alreadyCompleted: z.boolean().optional(),
    success: z.boolean().optional(),
    code: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough()

/**
 * The reserve RPC envelope is one protocol shared by every credit flavor
 * (generate/regenerate questions, variant rolls); only the completed-item key
 * and its schema differ. This generic parses the shared envelope once so the
 * flavors cannot drift; wrappers below rename `item` to their payload.
 */
export type ParsedReserveEnvelope<TItem> =
  | {
      kind: "completed"
      item: TItem
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

export function parseReserveEnvelope<TItem>(
  reserveResult: unknown,
  options: {
    /** Key carrying the already-completed item, e.g. `question` or `roll`. */
    itemKey: string
    itemSchema: z.ZodType<TItem>
    failureMessage: string
  }
): ParsedReserveEnvelope<TItem> | null {
  const shape = reserveResponseShapeSchema.safeParse(reserveResult)

  if (!shape.success) {
    return null
  }

  if (shape.data.success === false) {
    const failed = resolveStructuredFailure(
      shape.data,
      "RESERVE_FAILED",
      options.failureMessage
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
    const item = options.itemSchema.safeParse(
      (shape.data as Record<string, unknown>)[options.itemKey]
    )

    if (!item.success) {
      return null
    }

    return {
      kind: "completed",
      item: item.data,
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

export function parseReserveResponse(reserveResult: unknown): ParsedReserveResponse | null {
  const envelope = parseReserveEnvelope(reserveResult, {
    itemKey: "question",
    itemSchema: worksheetQuestionSchema,
    failureMessage: "Could not reserve a credit for this question.",
  })

  if (envelope === null) {
    return null
  }

  if (envelope.kind === "completed") {
    return {
      kind: "completed",
      question: envelope.item,
      creditBalance: envelope.creditBalance,
    }
  }

  return envelope
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

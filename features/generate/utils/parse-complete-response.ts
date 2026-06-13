import { z } from "zod"

import { failure, resolveStructuredFailure } from "@/features/generate/errors"
import type { AppFailure } from "@/features/generate/errors"
import { worksheetQuestionSchema } from "@/features/generate/schemas"
import type { WorksheetQuestion } from "@/features/generate/types"

export type CompleteQuestionResult = {
  question: WorksheetQuestion
  creditBalance: number
}

const completeResponseShapeSchema = z
  .object({
    success: z.boolean(),
    question: z.unknown().optional(),
    creditBalance: z.union([z.number(), z.string()]).optional(),
    message: z.string().optional(),
    code: z.string().optional(),
  })
  .passthrough()

export function parseCreditBalance(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.trunc(raw))
  }

  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed))
    }
  }

  return null
}

export function parseCompleteResponse(
  completeResult: unknown
):
  | { ok: true; data: CompleteQuestionResult }
  | (AppFailure & { creditBalance?: number }) {
  const shape = completeResponseShapeSchema.safeParse(completeResult)

  if (!shape.success) {
    return failure("UNKNOWN", "Invalid complete response.")
  }

  const creditBalance = parseCreditBalance(shape.data.creditBalance)

  if (shape.data.success === false) {
    return {
      ...resolveStructuredFailure(shape.data, "UNKNOWN"),
      ...(creditBalance !== null ? { creditBalance } : {}),
    }
  }

  const question = worksheetQuestionSchema.safeParse(shape.data.question)

  if (!question.success || creditBalance === null) {
    return failure("UNKNOWN", "Invalid complete response.")
  }

  return {
    ok: true,
    data: {
      question: question.data,
      creditBalance,
    },
  }
}

export function completeResponseWasDbRefunded(completeResult: unknown): boolean {
  const shape = completeResponseShapeSchema.safeParse(completeResult)
  return shape.success && shape.data.success === false
}

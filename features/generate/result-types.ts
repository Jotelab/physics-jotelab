import type { AppFailure } from "./errors"
import type { WorksheetQuestion } from "./types"

export type GenerateQuestionResult =
  | { ok: true; data: { question: WorksheetQuestion; creditBalance: number } }
  | AppFailure

export type ActionResult<T> = { ok: true; data: T } | AppFailure

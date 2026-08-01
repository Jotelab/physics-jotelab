import type { AppFailure, AppFailureWithCreditBalance } from "./errors"
import type { WorksheetQuestion } from "./types"

export type GenerateQuestionResult =
  | { ok: true; data: { question: WorksheetQuestion; creditBalance: number } }
  | AppFailureWithCreditBalance

export type ActionResult<T> = { ok: true; data: T } | AppFailure

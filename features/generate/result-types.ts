import type { AppFailure } from "./errors"
import type { WorksheetQuestion } from "./types"

/**
 * A failure that also reports the credit balance.
 *
 * When the database refunds a reservation itself, `parseCompleteResponse`
 * returns the post-refund balance alongside the error code so the UI can show
 * the corrected figure without a second round trip. The value was already
 * flowing at runtime; the type used to drop it, which made a passing assertion
 * in `generate-question-core.test.ts` look like a type error.
 */
export type GenerateQuestionFailure = AppFailure & { creditBalance?: number }

export type GenerateQuestionResult =
  | { ok: true; data: { question: WorksheetQuestion; creditBalance: number } }
  | GenerateQuestionFailure

export type ActionResult<T> = { ok: true; data: T } | AppFailure

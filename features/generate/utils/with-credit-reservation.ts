import {
  failure,
  parseRpcFailure,
  parseStructuredRpcFailure,
} from "@/features/generate/errors"
import type { AppFailure, GenerationErrorCode } from "@/features/generate/errors"
import {
  getGenerationFailure,
  logGenerationError,
} from "@/lib/ai/generation-errors"

/**
 * The reserved-slot context handed to the work callback once a credit has been
 * successfully reserved for an in-progress generation.
 */
export type ReservedContext = {
  reservationId: string
  creditBalance: number
  pendingQuestionId?: string
}

/**
 * Normalized outcome of parsing a reserve RPC response. The `completed` data is
 * caller-shaped (`{ question, creditBalance }` for generation, `{ roll,
 * creditBalance }` for variant rolls), hence the generic.
 */
export type ParsedReservation<TData> =
  | { kind: "completed"; data: TData }
  | {
      kind: "reserved"
      reservationId: string
      creditBalance: number
      pendingQuestionId?: string
    }
  | { kind: "failed"; code: GenerationErrorCode; message: string }

/**
 * Outcome of the generate → complete work performed against a reserved slot.
 * On failure, `cancel` decides whether the reservation should be released (the
 * DB may already have refunded the credit, in which case we must not double
 * cancel).
 */
export type CompleteOutcome<TData> =
  | { ok: true; data: TData }
  | { ok: false; failure: AppFailure; cancel: boolean }

export type ReservationResult<TData> =
  | { ok: true; data: TData }
  | AppFailure

function parseReserveRpcFailure(
  reserveResult: unknown,
  reserveError: unknown,
  fallbackCode: GenerationErrorCode
): AppFailure | null {
  const structured = parseStructuredRpcFailure(reserveResult, fallbackCode)
  if (structured) {
    return structured
  }

  if (reserveError || !reserveResult) {
    return parseRpcFailure(reserveError, fallbackCode)
  }

  return null
}

/**
 * Runs the shared reserve → generate → complete → cancel credit skeleton.
 *
 * The control flow (parsing reserve failures, short-circuiting on an
 * already-completed slot, the `reservationActive` bookkeeping, and the
 * cancel-on-failure / cancel-on-throw guarantees) lives here so that
 * `generateQuestionForWorksheet`, `regenerateQuestionForWorksheet`, and
 * `generateVariantRollForQuestion` no longer each re-implement it.
 *
 * Callers provide the RPC-specific pieces:
 * - `reserve`: invoke the reserve RPC and return its `{ data, error }`.
 * - `parseReservation`: turn the reserve response into a `ParsedReservation`
 *   (or `null` for an unparseable response).
 * - `run`: generate the content and complete the reservation against the
 *   reserved slot, returning a `CompleteOutcome`.
 * - `cancel`: release the reservation by id.
 */
export async function withCreditReservation<TData>(options: {
  /** Label passed to `logGenerationError` when the work throws. */
  errorContext: string
  /** Code used by `getGenerationFailure` for an uncaught throw. */
  fallbackCode: GenerationErrorCode
  /** Code used when the reserve RPC fails or returns an unparseable response. */
  reserveFallbackCode: GenerationErrorCode
  reserve: () => PromiseLike<{ data: unknown; error: unknown }>
  parseReservation: (reserveResult: unknown) => ParsedReservation<TData> | null
  run: (context: ReservedContext) => Promise<CompleteOutcome<TData>>
  cancel: (reservationId: string) => Promise<void>
}): Promise<ReservationResult<TData>> {
  const { data: reserveResult, error: reserveError } = await options.reserve()

  const reserveFailure = parseReserveRpcFailure(
    reserveResult,
    reserveError,
    options.reserveFallbackCode
  )
  if (reserveFailure) {
    return reserveFailure
  }

  const reservation = options.parseReservation(reserveResult)

  if (!reservation) {
    return failure(options.reserveFallbackCode)
  }

  if (reservation.kind === "failed") {
    return failure(reservation.code, reservation.message)
  }

  if (reservation.kind === "completed") {
    return { ok: true, data: reservation.data }
  }

  const context: ReservedContext = {
    reservationId: reservation.reservationId,
    creditBalance: reservation.creditBalance,
    ...(reservation.pendingQuestionId
      ? { pendingQuestionId: reservation.pendingQuestionId }
      : {}),
  }

  let reservationActive = true

  try {
    const outcome = await options.run(context)

    if (!outcome.ok) {
      reservationActive = false

      if (outcome.cancel) {
        await options.cancel(context.reservationId)
      }

      return outcome.failure
    }

    reservationActive = false

    return { ok: true, data: outcome.data }
  } catch (error) {
    if (reservationActive) {
      await options.cancel(context.reservationId)
    }

    logGenerationError(options.errorContext, error)
    return getGenerationFailure(error, options.fallbackCode)
  }
}

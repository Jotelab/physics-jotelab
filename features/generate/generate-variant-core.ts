import type { SupabaseClient } from "@supabase/supabase-js"

import { variantWorksheetQuestion } from "@/lib/ai/variant-question"
import {
  getGenerationFailure,
  logGenerationError,
} from "@/lib/ai/generation-errors"

import {
  failure,
  parseRpcFailure,
  parseStructuredRpcFailure,
} from "./errors"
import type { AppFailure, GenerationErrorCode } from "./errors"
import { variantQuestionRollSchema, generationSettingsSchema } from "./schemas"
import type { VariantLabel, VariantQuestionRoll, WorksheetQuestion } from "./types"
import { fetchWorksheetQuestions } from "./utils/fetch-worksheet-questions"
import { buildVariantRollIdempotencyKey } from "./utils/idempotency-key"
import {
  parseVariantRollCompleteResponse,
  parseVariantRollReserveResponse,
} from "./utils/parse-variant-roll-response"
import { DEFAULT_MATH_COMPLEXITY } from "./constants/difficulty-settings"

const VARIANT_FALLBACK_CODE = "VARIANT_FAILED" as const

type WorksheetRow = {
  id: string
  user_id: string
  question_count: number
  generation_settings: unknown
}

async function getWorksheetForProfile(
  supabase: SupabaseClient,
  worksheetId: string,
  profileId: string
): Promise<WorksheetRow | null> {
  const { data: worksheet, error } = await supabase
    .from("worksheets")
    .select("id, user_id, question_count, generation_settings")
    .eq("id", worksheetId)
    .single<WorksheetRow>()

  if (error || !worksheet || worksheet.user_id !== profileId) {
    return null
  }

  return worksheet
}

async function cancelVariantRollReservation(
  supabase: SupabaseClient,
  reservationId: string,
  idempotencyKey: string
) {
  await supabase.rpc("cancel_variant_roll_reservation", {
    p_reservation_id: reservationId,
    p_idempotency_key: idempotencyKey,
  })
}

function parseReserveRpcFailure(
  reserveResult: unknown,
  reserveError: unknown,
  fallbackCode: GenerationErrorCode = VARIANT_FALLBACK_CODE
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

function toVariantRoll(
  masterQuestion: WorksheetQuestion,
  generated: Awaited<ReturnType<typeof variantWorksheetQuestion>>
): VariantQuestionRoll {
  const roll: VariantQuestionRoll = {
    order: masterQuestion.order,
    given_values: generated.given_values,
    solution: generated.solution,
  }

  if (generated.question_text.trim() !== masterQuestion.question_text.trim()) {
    roll.question_text = generated.question_text
  }

  return variantQuestionRollSchema.parse(roll)
}

export type VariantRollResult =
  | { ok: true; data: { roll: VariantQuestionRoll; creditBalance: number } }
  | AppFailure

export async function generateVariantRollForQuestion(params: {
  supabase: SupabaseClient
  profileId: string
  worksheetId: string
  label: VariantLabel
  order: number
}): Promise<VariantRollResult> {
  const { supabase, profileId, worksheetId, label, order } = params

  const worksheet = await getWorksheetForProfile(supabase, worksheetId, profileId)

  if (!worksheet) {
    return failure("WORKSHEET_ACCESS_DENIED")
  }

  if (order > worksheet.question_count) {
    return failure("WORKSHEET_ALREADY_COMPLETE")
  }

  const existingQuestions = await fetchWorksheetQuestions(supabase, worksheetId)

  if (existingQuestions === null) {
    return failure("QUESTIONS_LOAD_FAILED")
  }

  if (existingQuestions.length < worksheet.question_count) {
    return failure("VALIDATION_FAILED", "Worksheet must be fully generated before creating variants.")
  }

  const masterQuestion = existingQuestions.find((question) => question.order === order)

  if (!masterQuestion) {
    return failure("QUESTION_NOT_FOUND")
  }

  const generationSettings = generationSettingsSchema.safeParse(worksheet.generation_settings)
  const mathComplexity = generationSettings.success
    ? (generationSettings.data.math_complexity ?? DEFAULT_MATH_COMPLEXITY)
    : DEFAULT_MATH_COMPLEXITY

  const idempotencyKey = buildVariantRollIdempotencyKey(worksheet.id, label, order)

  const { data: reserveResult, error: reserveError } = await supabase.rpc(
    "reserve_variant_roll_credit",
    {
      p_worksheet_id: worksheet.id,
      p_variant_label: label,
      p_order: order,
      p_idempotency_key: idempotencyKey,
    }
  )

  const reserveFailure = parseReserveRpcFailure(reserveResult, reserveError)
  if (reserveFailure) {
    return reserveFailure
  }

  const reservation = parseVariantRollReserveResponse(reserveResult)

  if (!reservation) {
    return failure(VARIANT_FALLBACK_CODE)
  }

  if (reservation.kind === "failed") {
    return failure(reservation.code, reservation.message)
  }

  if (reservation.kind === "completed") {
    return {
      ok: true,
      data: {
        roll: reservation.roll,
        creditBalance: reservation.creditBalance,
      },
    }
  }

  let reservationActive = true

  try {
    const generatedQuestion = await variantWorksheetQuestion({
      masterQuestion,
      variantLabel: label,
      mathComplexity,
    })

    const roll = toVariantRoll(masterQuestion, generatedQuestion)

    const { data: completeResult, error: completeError } = await supabase.rpc(
      "complete_variant_roll_reservation",
      {
        p_reservation_id: reservation.reservationId,
        p_roll: roll,
        p_idempotency_key: idempotencyKey,
      }
    )

    if (completeError || !completeResult) {
      reservationActive = false
      await cancelVariantRollReservation(supabase, reservation.reservationId, idempotencyKey)

      return parseRpcFailure(completeError, VARIANT_FALLBACK_CODE)
    }

    const parsedCompleteResult = parseVariantRollCompleteResponse(completeResult)

    if (!parsedCompleteResult.ok) {
      reservationActive = false
      await cancelVariantRollReservation(supabase, reservation.reservationId, idempotencyKey)

      return parsedCompleteResult
    }

    reservationActive = false

    return {
      ok: true,
      data: parsedCompleteResult.data,
    }
  } catch (error) {
    if (reservationActive) {
      await cancelVariantRollReservation(supabase, reservation.reservationId, idempotencyKey)
    }

    logGenerationError("generateVariantRollForQuestion", error)
    return getGenerationFailure(error, VARIANT_FALLBACK_CODE)
  }
}

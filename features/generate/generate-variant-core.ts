import type { SupabaseClient } from "@supabase/supabase-js"

import {
  generateEngineQuestion,
  sympyDataGivenNames,
} from "@/lib/ai/generate-engine-question"
import { variantWorksheetQuestion } from "@/lib/ai/variant-question"
import { shouldUseEngine } from "@/lib/engine/topics"

import { failure, parseRpcFailure } from "./errors"
import type { AppFailure } from "./errors"
import { variantQuestionRollSchema, generationSettingsSchema } from "./schemas"
import type { VariantLabel, VariantQuestionRoll, WorksheetQuestion } from "./types"
import { fetchWorksheetQuestions } from "./utils/fetch-worksheet-questions"
import { buildVariantRollIdempotencyKey } from "./utils/idempotency-key"
import {
  parseVariantRollCompleteResponse,
  parseVariantRollReserveResponse,
} from "./utils/parse-variant-roll-response"
import { withCreditReservation } from "./utils/with-credit-reservation"
import type { ParsedReservation } from "./utils/with-credit-reservation"
import { loadOwnedWorksheet } from "./utils/load-owned-worksheet"
import type { OwnedWorksheetRow } from "./utils/load-owned-worksheet"
import { DEFAULT_MATH_COMPLEXITY } from "./constants/difficulty-settings"

const VARIANT_FALLBACK_CODE = "VARIANT_FAILED" as const

type VariantRollData = { roll: VariantQuestionRoll; creditBalance: number }

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

function toParsedVariantReservation(
  reserveResult: unknown
): ParsedReservation<VariantRollData> | null {
  const reservation = parseVariantRollReserveResponse(reserveResult)

  if (!reservation) {
    return null
  }

  if (reservation.kind === "completed") {
    return {
      kind: "completed",
      data: {
        roll: reservation.roll,
        creditBalance: reservation.creditBalance,
      },
    }
  }

  return reservation
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

  // Engine-backed rolls store the verified payload verbatim, like a question.
  if (generated.sympy_data) {
    roll.sympy_data = generated.sympy_data
  }

  return variantQuestionRollSchema.parse(roll)
}

export type VariantRollResult = { ok: true; data: VariantRollData } | AppFailure

export async function generateVariantRollForQuestion(params: {
  supabase: SupabaseClient
  profileId: string
  worksheetId: string
  label: VariantLabel
  order: number
  /**
   * The worker's already-loaded worksheet + master questions (masters never
   * change during a variant job), threaded in to avoid one worksheet lookup and
   * one full question fetch per roll. Direct calls omit them and load here.
   */
  knownWorksheet?: OwnedWorksheetRow
  knownQuestions?: WorksheetQuestion[]
}): Promise<VariantRollResult> {
  const { supabase, profileId, worksheetId, label, order, knownWorksheet, knownQuestions } =
    params

  const worksheet =
    knownWorksheet ?? (await loadOwnedWorksheet(supabase, worksheetId, profileId))

  if (!worksheet) {
    return failure("WORKSHEET_ACCESS_DENIED")
  }

  if (order > worksheet.question_count) {
    return failure("WORKSHEET_ALREADY_COMPLETE")
  }

  const existingQuestions =
    knownQuestions ?? (await fetchWorksheetQuestions(supabase, worksheetId))

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

  const parsedSettings = generationSettingsSchema.safeParse(worksheet.generation_settings)
  const generationSettings = parsedSettings.success ? parsedSettings.data : null
  const mathComplexity = generationSettings?.math_complexity ?? DEFAULT_MATH_COMPLEXITY

  const idempotencyKey = buildVariantRollIdempotencyKey(worksheet.id, label, order)

  return withCreditReservation<VariantRollData>({
    errorContext: "generateVariantRollForQuestion",
    fallbackCode: VARIANT_FALLBACK_CODE,
    reserveFallbackCode: VARIANT_FALLBACK_CODE,
    reserve: () =>
      supabase.rpc("reserve_variant_roll_credit", {
        p_worksheet_id: worksheet.id,
        p_variant_label: label,
        p_order: order,
        p_idempotency_key: idempotencyKey,
      }),
    parseReservation: toParsedVariantReservation,
    cancel: (reservationId) =>
      cancelVariantRollReservation(supabase, reservationId, idempotencyKey),
    run: async (context) => {
      // Neuro-symbolic invariant (DEVELOPMENT_PLAN §0): an engine-backed master
      // re-rolls through the engine — same Given/Find split, fresh seed, LLM
      // phrases only — so variant numbers and answer keys stay verified. The
      // LLM variant path remains for LLM-only lessons and legacy rows. E2E stub
      // mode keeps the variant stub (it varies numbers per label).
      const masterSympyData = masterQuestion.sympy_data
      const generatedQuestion =
        masterSympyData !== undefined &&
        generationSettings !== null &&
        process.env.E2E_STUB_GENERATION !== "true" &&
        shouldUseEngine(generationSettings.lesson, worksheet.subject)
          ? await generateEngineQuestion({
              subject: worksheet.subject,
              lesson: generationSettings.lesson,
              scenario: generationSettings.scenario,
              previousQuestionsContext: [masterQuestion.question_text],
              mathComplexity,
              given: sympyDataGivenNames(masterSympyData),
              find: masterSympyData.find.symbol,
            })
          : await variantWorksheetQuestion({
              subject: worksheet.subject,
              masterQuestion,
              variantLabel: label,
              mathComplexity,
            })

      const roll = toVariantRoll(masterQuestion, generatedQuestion)

      const { data: completeResult, error: completeError } = await supabase.rpc(
        "complete_variant_roll_reservation",
        {
          p_reservation_id: context.reservationId,
          p_roll: roll,
          p_idempotency_key: idempotencyKey,
        }
      )

      if (completeError || !completeResult) {
        return {
          ok: false,
          failure: parseRpcFailure(completeError, VARIANT_FALLBACK_CODE),
          cancel: true,
        }
      }

      const parsedCompleteResult = parseVariantRollCompleteResponse(completeResult)

      if (!parsedCompleteResult.ok) {
        return { ok: false, failure: parsedCompleteResult, cancel: true }
      }

      return { ok: true, data: parsedCompleteResult.data }
    },
  })
}

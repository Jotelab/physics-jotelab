import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { generateWorksheetQuestion } from "@/lib/ai/generate-question"
import {
  getGenerationFailure,
  logGenerationError,
} from "@/lib/ai/generation-errors"
import { regenerateWorksheetQuestion } from "@/lib/ai/regenerate-question"

import {
  failure,
  parseRpcFailure,
  parseStructuredRpcFailure,
} from "./errors"
import type { AppFailure, GenerationErrorCode } from "./errors"
import type { GenerateQuestionResult } from "./result-types"
import { buildScenarioPrompt } from "./utils/build-scenario-prompt"
import { buildGenerateIdempotencyKey, buildRegenerateIdempotencyKey } from "./utils/idempotency-key"
import {
  DEFAULT_CONCEPTUAL_DIFFICULTY,
  DEFAULT_MATH_COMPLEXITY,
} from "./constants/difficulty-settings"
import {
  getTargetPoolFromSettings,
  resolveQuestionTarget,
} from "./utils/resolve-question-target"
import {
  completeResponseWasDbRefunded,
  parseCompleteResponse,
} from "./utils/parse-complete-response"
import { parseReserveResponse } from "./utils/parse-reservation-response"
import { generationSettingsSchema, worksheetQuestionSchema } from "./schemas"
import { fetchWorksheetQuestions } from "./utils/fetch-worksheet-questions"
import type { Subject } from "./types"

type WorksheetRow = {
  id: string
  user_id: string
  subject: Subject
  question_count: number
  generation_settings: unknown
}

type ProfileRow = {
  credit_balance: number
}

function parseGenerationSettings(settings: unknown) {
  const parsed = generationSettingsSchema.safeParse(settings)
  return parsed.success ? parsed.data : null
}

function getPromptScenario(
  generationSettings: z.infer<typeof generationSettingsSchema>,
  order: number,
  worksheetId: string
) {
  const pool = getTargetPoolFromSettings(generationSettings)
  const activeTarget = resolveQuestionTarget(generationSettings, order, worksheetId)

  return buildScenarioPrompt(
    generationSettings.scenario,
    generationSettings.given_variables,
    activeTarget,
    {
      pool: pool.length > 1 ? pool : undefined,
      mode: generationSettings.target_randomize ? "random" : "rotate",
      conceptualDifficulty:
        generationSettings.conceptual_difficulty ?? DEFAULT_CONCEPTUAL_DIFFICULTY,
    }
  )
}

async function getWorksheetForProfile(
  supabase: SupabaseClient,
  worksheetId: string,
  profileId: string
): Promise<WorksheetRow | null> {
  const { data: worksheet, error } = await supabase
    .from("worksheets")
    .select("id, user_id, subject, question_count, generation_settings")
    .eq("id", worksheetId)
    .single<WorksheetRow>()

  if (error || !worksheet || worksheet.user_id !== profileId) {
    return null
  }

  return worksheet
}

async function getProfileCreditBalance(
  supabase: SupabaseClient,
  profileId: string
): Promise<number | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("credit_balance")
    .eq("id", profileId)
    .single<ProfileRow>()

  return profile?.credit_balance ?? null
}

async function cancelGenerateReservation(
  supabase: SupabaseClient,
  reservationId: string,
  idempotencyKey: string
) {
  await supabase.rpc("cancel_generate_question_reservation", {
    p_reservation_id: reservationId,
    p_idempotency_key: idempotencyKey,
  })
}

async function cancelRegenerateReservation(
  supabase: SupabaseClient,
  reservationId: string,
  idempotencyKey: string
) {
  await supabase.rpc("cancel_regenerate_question_reservation", {
    p_reservation_id: reservationId,
    p_idempotency_key: idempotencyKey,
  })
}

const REGENERATE_FALLBACK_CODE = "REGENERATE_FAILED" as const

function mapInvalidCompleteFailure(
  result: AppFailure,
  fallbackCode: GenerationErrorCode = "SAVE_FAILED"
): AppFailure {
  if (result.code === "UNKNOWN" && result.message === "Invalid complete response.") {
    return failure(fallbackCode)
  }

  return result
}

function parseReserveRpcFailure(
  reserveResult: unknown,
  reserveError: unknown,
  fallbackCode: "RESERVE_FAILED" | "REGENERATE_FAILED"
) {
  const structured = parseStructuredRpcFailure(reserveResult, fallbackCode)
  if (structured) {
    return structured
  }

  if (reserveError || !reserveResult) {
    return parseRpcFailure(reserveError, fallbackCode)
  }

  return null
}

export async function generateQuestionForWorksheet(params: {
  supabase: SupabaseClient
  profileId: string
  worksheetId: string
  order: number
  previousQuestionsContext: string[]
}): Promise<GenerateQuestionResult> {
  const { supabase, profileId, worksheetId, order, previousQuestionsContext } = params

  const worksheet = await getWorksheetForProfile(supabase, worksheetId, profileId)

  if (!worksheet) {
    return failure("WORKSHEET_ACCESS_DENIED")
  }

  if (order > worksheet.question_count) {
    return failure("WORKSHEET_ALREADY_COMPLETE")
  }

  const generationSettings = parseGenerationSettings(worksheet.generation_settings)

  if (!generationSettings) {
    return failure("GENERATION_SETTINGS_MISSING")
  }

  const existingQuestions = await fetchWorksheetQuestions(supabase, worksheetId)

  if (existingQuestions === null) {
    return failure("QUESTIONS_LOAD_FAILED")
  }

  const existingAtOrder = existingQuestions.find((question) => question.order === order)

  if (existingAtOrder) {
    const creditBalance = await getProfileCreditBalance(supabase, profileId)

    if (creditBalance === null) {
      return failure("CREDIT_BALANCE_UNAVAILABLE")
    }

    return {
      ok: true,
      data: {
        question: existingAtOrder,
        creditBalance,
      },
    }
  }

  const idempotencyKey = buildGenerateIdempotencyKey(worksheet.id, order)

  const { data: reserveResult, error: reserveError } = await supabase.rpc(
    "reserve_generate_question_credit",
    {
      p_worksheet_id: worksheet.id,
      p_order: order,
      p_idempotency_key: idempotencyKey,
    }
  )

  const reserveFailure = parseReserveRpcFailure(reserveResult, reserveError, "RESERVE_FAILED")
  if (reserveFailure) {
    return reserveFailure
  }

  const reservation = parseReserveResponse(reserveResult)

  if (!reservation) {
    return failure("RESERVE_FAILED")
  }

  if (reservation.kind === "failed") {
    return failure(reservation.code, reservation.message)
  }

  if (reservation.kind === "completed") {
    return {
      ok: true,
      data: {
        question: reservation.question,
        creditBalance: reservation.creditBalance,
      },
    }
  }

  let reservationActive = true

  try {
    const generatedQuestion = await generateWorksheetQuestion({
      subject: worksheet.subject,
      lesson: generationSettings.lesson,
      scenario: getPromptScenario(generationSettings, order, worksheet.id),
      previousQuestionsContext,
      mathComplexity: generationSettings.math_complexity ?? DEFAULT_MATH_COMPLEXITY,
    })

    const question = worksheetQuestionSchema.parse({
      id: reservation.pendingQuestionId ?? crypto.randomUUID(),
      order,
      ...generatedQuestion,
    })

    const { data: completeResult, error: completeError } = await supabase.rpc(
      "complete_generate_question_reservation",
      {
        p_reservation_id: reservation.reservationId,
        p_question: question,
        p_idempotency_key: idempotencyKey,
      }
    )

    if (completeError || !completeResult) {
      reservationActive = false
      await cancelGenerateReservation(supabase, reservation.reservationId, idempotencyKey)

      return parseRpcFailure(completeError, "SAVE_FAILED")
    }

    const parsedCompleteResult = parseCompleteResponse(completeResult)

    if (!parsedCompleteResult.ok) {
      reservationActive = false

      if (!completeResponseWasDbRefunded(completeResult)) {
        await cancelGenerateReservation(supabase, reservation.reservationId, idempotencyKey)
      }

      return mapInvalidCompleteFailure(parsedCompleteResult, "SAVE_FAILED")
    }

    reservationActive = false

    return {
      ok: true,
      data: parsedCompleteResult.data,
    }
  } catch (error) {
    if (reservationActive) {
      await cancelGenerateReservation(supabase, reservation.reservationId, idempotencyKey)
    }

    logGenerationError("generateQuestionForWorksheet", error)
    return getGenerationFailure(error)
  }
}

export async function regenerateQuestionForWorksheet(params: {
  supabase: SupabaseClient
  profileId: string
  worksheetId: string
  questionId: string
  attemptId: string
}): Promise<GenerateQuestionResult> {
  const { supabase, profileId, worksheetId, questionId, attemptId } = params

  const worksheet = await getWorksheetForProfile(supabase, worksheetId, profileId)

  if (!worksheet) {
    return failure("WORKSHEET_ACCESS_DENIED")
  }

  const generationSettings = parseGenerationSettings(worksheet.generation_settings)

  if (!generationSettings) {
    return failure("GENERATION_SETTINGS_MISSING")
  }

  const existingQuestions = await fetchWorksheetQuestions(supabase, worksheetId)

  if (existingQuestions === null) {
    return failure("QUESTIONS_LOAD_FAILED")
  }

  const originalQuestion = existingQuestions.find((question) => question.id === questionId)

  if (!originalQuestion) {
    return failure("QUESTION_NOT_FOUND")
  }

  const idempotencyKey = buildRegenerateIdempotencyKey(
    worksheet.id,
    originalQuestion.id,
    attemptId
  )

  const { data: reserveResult, error: reserveError } = await supabase.rpc(
    "reserve_regenerate_question_credit",
    {
      p_worksheet_id: worksheet.id,
      p_question_id: originalQuestion.id,
      p_idempotency_key: idempotencyKey,
    }
  )

  const reserveFailure = parseReserveRpcFailure(
    reserveResult,
    reserveError,
    "REGENERATE_FAILED"
  )
  if (reserveFailure) {
    return reserveFailure
  }

  const reservation = parseReserveResponse(reserveResult)

  if (!reservation) {
    return failure(REGENERATE_FALLBACK_CODE)
  }

  if (reservation.kind === "failed") {
    return failure(reservation.code, reservation.message)
  }

  if (reservation.kind === "completed") {
    return {
      ok: true,
      data: {
        question: reservation.question,
        creditBalance: reservation.creditBalance,
      },
    }
  }

  let reservationActive = true

  try {
    const generatedQuestion = await regenerateWorksheetQuestion({
      subject: worksheet.subject,
      lesson: generationSettings.lesson,
      scenario: getPromptScenario(
        generationSettings,
        originalQuestion.order,
        worksheet.id
      ),
      existingQuestionText: originalQuestion.question_text,
      mathComplexity: generationSettings.math_complexity ?? DEFAULT_MATH_COMPLEXITY,
    })

    const replacementQuestion = worksheetQuestionSchema.parse({
      id: originalQuestion.id,
      order: originalQuestion.order,
      ...generatedQuestion,
    })

    const { data: completeResult, error: completeError } = await supabase.rpc(
      "complete_regenerate_question_reservation",
      {
        p_reservation_id: reservation.reservationId,
        p_new_question: replacementQuestion,
        p_idempotency_key: idempotencyKey,
      }
    )

    if (completeError || !completeResult) {
      reservationActive = false
      await cancelRegenerateReservation(supabase, reservation.reservationId, idempotencyKey)

      return parseRpcFailure(completeError, REGENERATE_FALLBACK_CODE)
    }

    const parsedCompleteResult = parseCompleteResponse(completeResult)

    if (!parsedCompleteResult.ok) {
      reservationActive = false

      if (!completeResponseWasDbRefunded(completeResult)) {
        await cancelRegenerateReservation(supabase, reservation.reservationId, idempotencyKey)
      }

      return mapInvalidCompleteFailure(parsedCompleteResult, REGENERATE_FALLBACK_CODE)
    }

    reservationActive = false

    return {
      ok: true,
      data: parsedCompleteResult.data,
    }
  } catch (error) {
    if (reservationActive) {
      await cancelRegenerateReservation(supabase, reservation.reservationId, idempotencyKey)
    }

    logGenerationError("regenerateQuestionForWorksheet", error)
    return getGenerationFailure(error, REGENERATE_FALLBACK_CODE)
  }
}

export async function loadWorksheetQuestionsForProfile(
  supabase: SupabaseClient,
  worksheetId: string,
  profileId: string
) {
  const worksheet = await getWorksheetForProfile(supabase, worksheetId, profileId)
  if (!worksheet) {
    return null
  }

  const questions = await fetchWorksheetQuestions(supabase, worksheetId)

  if (questions === null) {
    throw new Error("Worksheet questions could not be loaded")
  }

  return {
    worksheet,
    questions,
  }
}

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { generateWorksheetQuestion } from "@/lib/ai/generate-question"
import {
  generateEngineQuestion,
  sympyDataGivenNames,
} from "@/lib/ai/generate-engine-question"
import { regenerateWorksheetQuestion } from "@/lib/ai/regenerate-question"
import {
  engineNameForDisplaySymbol,
  resolveEngineTopic,
  shouldUseEngine,
} from "@/lib/engine/topics"
import { attachQuestionDiagrams } from "@/lib/tikz/attach-diagram"

import { failure, parseRpcFailure } from "./errors"
import type { AppFailure, GenerationErrorCode } from "./errors"
import type { GenerateQuestionResult } from "./result-types"
import { withCreditReservation } from "./utils/with-credit-reservation"
import type { ParsedReservation } from "./utils/with-credit-reservation"
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
import { loadOwnedWorksheet } from "./utils/load-owned-worksheet"
import type { Subject, WorksheetQuestion } from "./types"

type ProfileRow = {
  credit_balance: number
}

function parseGenerationSettings(settings: unknown) {
  const parsed = generationSettingsSchema.safeParse(settings)
  return parsed.success ? parsed.data : null
}

/**
 * Advanced-mode pins translated to engine variable names (DEVELOPMENT_PLAN
 * §1.2/§6): the per-order target (rotation/randomization included, via
 * {@link resolveQuestionTarget}) becomes the engine `find` pin, and the user's
 * pinned given variables become a subset constraint the engine completes into a
 * valid split. Pins whose display symbol the topic does not know are dropped —
 * the engine then chooses freely, same as before the pin existed.
 */
function getEnginePins(
  generationSettings: z.infer<typeof generationSettingsSchema>,
  order: number,
  worksheetId: string,
  lesson: string,
  subject: Subject
): { given?: string[]; find?: string } {
  const topic = resolveEngineTopic(lesson, subject)
  if (!topic) {
    return {}
  }

  const target = resolveQuestionTarget(generationSettings, order, worksheetId)
  const find = target ? engineNameForDisplaySymbol(topic, target.symbol) : null

  const given = (generationSettings.given_variables ?? [])
    .map((variable) => engineNameForDisplaySymbol(topic, variable.symbol))
    .filter((name): name is string => name !== null)
    // A pinned target can never be one of its own givens.
    .filter((name) => name !== find)

  return {
    ...(given.length > 0 ? { given } : {}),
    ...(find ? { find } : {}),
  }
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

function toParsedQuestionReservation(
  reserveResult: unknown
): ParsedReservation<{ question: WorksheetQuestion; creditBalance: number }> | null {
  const reservation = parseReserveResponse(reserveResult)

  if (!reservation) {
    return null
  }

  if (reservation.kind === "completed") {
    return {
      kind: "completed",
      data: {
        question: reservation.question,
        creditBalance: reservation.creditBalance,
      },
    }
  }

  return reservation
}

export async function generateQuestionForWorksheet(params: {
  supabase: SupabaseClient
  profileId: string
  worksheetId: string
  order: number
  previousQuestionsContext: string[]
  /**
   * The worksheet's already-loaded questions. The worker threads its in-memory
   * list in to avoid an O(N^2) per-order re-read; when omitted (e.g. a direct
   * call) the questions are fetched here.
   */
  knownQuestions?: WorksheetQuestion[]
}): Promise<GenerateQuestionResult> {
  const { supabase, profileId, worksheetId, order, previousQuestionsContext, knownQuestions } =
    params

  const worksheet = await loadOwnedWorksheet(supabase, worksheetId, profileId)

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

  const existingQuestions = knownQuestions ?? (await fetchWorksheetQuestions(supabase, worksheetId))

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

  return withCreditReservation({
    errorContext: "generateQuestionForWorksheet",
    fallbackCode: "GENERATE_FAILED",
    reserveFallbackCode: "RESERVE_FAILED",
    reserve: () =>
      supabase.rpc("reserve_generate_question_credit", {
        p_worksheet_id: worksheet.id,
        p_order: order,
        p_idempotency_key: idempotencyKey,
      }),
    parseReservation: toParsedQuestionReservation,
    cancel: (reservationId) =>
      cancelGenerateReservation(supabase, reservationId, idempotencyKey),
    run: async (context) => {
      // Neuro-symbolic lessons generate through the engine (numbers first, LLM
      // phrases); other lessons stay on the pure-LLM path (DEVELOPMENT_PLAN §1.2).
      const generatedQuestion = shouldUseEngine(
        generationSettings.lesson,
        worksheet.subject
      )
        ? await generateEngineQuestion({
            subject: worksheet.subject,
            lesson: generationSettings.lesson,
            scenario: generationSettings.scenario,
            previousQuestionsContext,
            mathComplexity: generationSettings.math_complexity ?? DEFAULT_MATH_COMPLEXITY,
            // Advanced-mode pins (target rotation + given constraints), mapped
            // to engine names; the engine completes them into a valid split.
            ...getEnginePins(
              generationSettings,
              order,
              worksheet.id,
              generationSettings.lesson,
              worksheet.subject
            ),
            completeSplit: true,
          })
        : await generateWorksheetQuestion({
            subject: worksheet.subject,
            lesson: generationSettings.lesson,
            scenario: getPromptScenario(generationSettings, order, worksheet.id),
            previousQuestionsContext,
            mathComplexity: generationSettings.math_complexity ?? DEFAULT_MATH_COMPLEXITY,
          })

      const question = worksheetQuestionSchema.parse({
        id: context.pendingQuestionId ?? crypto.randomUUID(),
        order,
        ...generatedQuestion,
      })

      const { data: completeResult, error: completeError } = await supabase.rpc(
        "complete_generate_question_reservation",
        {
          p_reservation_id: context.reservationId,
          p_question: question,
          p_idempotency_key: idempotencyKey,
        }
      )

      if (completeError || !completeResult) {
        return {
          ok: false,
          failure: parseRpcFailure(completeError, "SAVE_FAILED"),
          cancel: true,
        }
      }

      const parsedCompleteResult = parseCompleteResponse(completeResult)

      if (!parsedCompleteResult.ok) {
        return {
          ok: false,
          failure: mapInvalidCompleteFailure(parsedCompleteResult, "SAVE_FAILED"),
          cancel: !completeResponseWasDbRefunded(completeResult),
        }
      }

      return { ok: true, data: parsedCompleteResult.data }
    },
  })
}

export async function regenerateQuestionForWorksheet(params: {
  supabase: SupabaseClient
  profileId: string
  worksheetId: string
  questionId: string
  attemptId: string
}): Promise<GenerateQuestionResult> {
  const { supabase, profileId, worksheetId, questionId, attemptId } = params

  const worksheet = await loadOwnedWorksheet(supabase, worksheetId, profileId)

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

  return withCreditReservation({
    errorContext: "regenerateQuestionForWorksheet",
    fallbackCode: REGENERATE_FALLBACK_CODE,
    reserveFallbackCode: REGENERATE_FALLBACK_CODE,
    reserve: () =>
      supabase.rpc("reserve_regenerate_question_credit", {
        p_worksheet_id: worksheet.id,
        p_question_id: originalQuestion.id,
        p_idempotency_key: idempotencyKey,
      }),
    parseReservation: toParsedQuestionReservation,
    cancel: (reservationId) =>
      cancelRegenerateReservation(supabase, reservationId, idempotencyKey),
    run: async (context) => {
      // Re-roll numbers: for an engine-backed question, resample the SAME
      // Given/Find split with a fresh engine seed — same topic + structure, new
      // numbers and new phrasing (DEVELOPMENT_PLAN §1.2). Questions without an
      // engine payload (LLM-only lessons / legacy rows) regenerate via the LLM.
      const originalSympyData = originalQuestion.sympy_data
      const generatedQuestion =
        originalSympyData &&
        shouldUseEngine(generationSettings.lesson, worksheet.subject)
          ? await generateEngineQuestion({
              subject: worksheet.subject,
              lesson: generationSettings.lesson,
              scenario: generationSettings.scenario,
              previousQuestionsContext: [originalQuestion.question_text],
              mathComplexity:
                generationSettings.math_complexity ?? DEFAULT_MATH_COMPLEXITY,
              given: sympyDataGivenNames(originalSympyData),
              find: originalSympyData.find.symbol,
            })
          : await regenerateWorksheetQuestion({
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
          p_reservation_id: context.reservationId,
          p_new_question: replacementQuestion,
          p_idempotency_key: idempotencyKey,
        }
      )

      if (completeError || !completeResult) {
        return {
          ok: false,
          failure: parseRpcFailure(completeError, REGENERATE_FALLBACK_CODE),
          cancel: true,
        }
      }

      const parsedCompleteResult = parseCompleteResponse(completeResult)

      if (!parsedCompleteResult.ok) {
        return {
          ok: false,
          failure: mapInvalidCompleteFailure(parsedCompleteResult, REGENERATE_FALLBACK_CODE),
          cancel: !completeResponseWasDbRefunded(completeResult),
        }
      }

      return { ok: true, data: parsedCompleteResult.data }
    },
  })
}

export async function loadWorksheetQuestionsForProfile(
  supabase: SupabaseClient,
  worksheetId: string,
  profileId: string,
  options?: {
    /**
     * Diagrams belong to the display boundary (DEVELOPMENT_PLAN §2.2). Internal
     * reads that only need question text/context (e.g. the generation worker's
     * prompt-context load) pass `false` to skip the WASM TeX compiles entirely.
     */
    attachDiagrams?: boolean
  }
) {
  const worksheet = await loadOwnedWorksheet(supabase, worksheetId, profileId)
  if (!worksheet) {
    return null
  }

  const rawQuestions = await fetchWorksheetQuestions(supabase, worksheetId)

  if (rawQuestions === null) {
    throw new Error("Worksheet questions could not be loaded")
  }

  const questions =
    options?.attachDiagrams === false
      ? rawQuestions
      : await attachQuestionDiagrams(rawQuestions)

  return {
    worksheet,
    questions,
  }
}

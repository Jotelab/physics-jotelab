"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { localizedFailure } from "@/lib/i18n/server-errors"

import {
  parseRpcFailure,
  parseStructuredRpcFailure,
  parseRpcSuccessObjectField,
} from "./errors"
import { regenerateQuestionForWorksheet } from "./generate-question-core"
import type { ActionResult } from "./result-types"
import { generatedQuestionSchema, worksheetQuestionSchema } from "./schemas"
import type { WorksheetQuestion } from "./types"
import { fetchWorksheetQuestions } from "./utils/fetch-worksheet-questions"

const questionActionInputSchema = z.object({
  worksheetId: z.string().uuid(),
  questionId: z.string().uuid(),
})

const editQuestionInputSchema = questionActionInputSchema.extend({
  editedQuestion: generatedQuestionSchema,
})

type WorksheetRow = {
  id: string
  subject: "math" | "physics" | "chemistry"
  question_count: number
  generation_settings: unknown
}

async function getProfileIdForAuthUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authUserId: string
) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single<{ id: string }>()

  return data?.id ?? null
}

async function getWorksheetForCurrentUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  worksheetId: string
) {
  const { data: worksheet, error: worksheetError } = await supabase
    .from("worksheets")
    .select("id, subject, question_count, generation_settings")
    .eq("id", worksheetId)
    .single<WorksheetRow>()

  if (worksheetError || !worksheet) {
    return null
  }

  return worksheet
}

export async function editQuestionAction(
  input: z.infer<typeof editQuestionInputSchema>
): Promise<ActionResult<{ question: WorksheetQuestion }>> {
  const parsed = editQuestionInputSchema.safeParse(input)

  if (!parsed.success) {
    return localizedFailure("VALIDATION_FAILED", "checkEditedQuestion")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return localizedFailure("NOT_AUTHENTICATED", "notAuthenticatedEdit")
  }

  const worksheet = await getWorksheetForCurrentUser(supabase, parsed.data.worksheetId)

  if (!worksheet) {
    return localizedFailure("WORKSHEET_ACCESS_DENIED")
  }

  const existingQuestions = await fetchWorksheetQuestions(supabase, worksheet.id)

  if (existingQuestions === null) {
    return localizedFailure("QUESTIONS_LOAD_FAILED")
  }

  const originalQuestion = existingQuestions.find(
    (question) => question.id === parsed.data.questionId
  )

  if (!originalQuestion) {
    return localizedFailure("QUESTION_NOT_FOUND")
  }

  const editedQuestion = worksheetQuestionSchema.parse({
    ...parsed.data.editedQuestion,
    id: originalQuestion.id,
    order: originalQuestion.order,
  })

  const { data, error } = await supabase.rpc("replace_worksheet_question", {
    p_worksheet_id: worksheet.id,
    p_question_id: originalQuestion.id,
    p_edited_question: editedQuestion,
  })

  const structuredFailure = parseStructuredRpcFailure(
    data,
    "SAVE_FAILED",
    (await localizedFailure("SAVE_FAILED", "couldNotSaveEdit")).message
  )
  if (structuredFailure) {
    return structuredFailure
  }

  const savedQuestion = parseRpcSuccessObjectField(data, "question")
  if (!savedQuestion) {
    return parseRpcFailure(
      error,
      "SAVE_FAILED",
      (await localizedFailure("SAVE_FAILED", "couldNotSaveEdit")).message
    )
  }

  revalidatePath("/generate")
  return {
    ok: true,
    data: {
      question: worksheetQuestionSchema.parse(savedQuestion),
    },
  }
}

export async function regenerateQuestionAction(
  input: z.infer<typeof questionActionInputSchema>
): Promise<ActionResult<{ question: WorksheetQuestion; creditBalance: number }>> {
  const parsed = questionActionInputSchema.safeParse(input)

  if (!parsed.success) {
    return localizedFailure("VALIDATION_FAILED", "couldNotRegenerate")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return localizedFailure("NOT_AUTHENTICATED", "notAuthenticatedRegenerate")
  }

  const profileId = await getProfileIdForAuthUser(supabase, user.id)

  if (!profileId) {
    return localizedFailure("PROFILE_NOT_FOUND")
  }

  const result = await regenerateQuestionForWorksheet({
    supabase,
    profileId,
    worksheetId: parsed.data.worksheetId,
    questionId: parsed.data.questionId,
  })

  if (result.ok) {
    revalidatePath("/generate")
  }

  return result
}

export async function getWorksheetQuestionCountAction(
  worksheetId: string
): Promise<ActionResult<{ questionCount: number }>> {
  const parsed = z.string().uuid().safeParse(worksheetId)

  if (!parsed.success) {
    return localizedFailure("VALIDATION_FAILED", "invalidWorksheet")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return localizedFailure("NOT_AUTHENTICATED", "notAuthenticatedView")
  }

  const worksheet = await getWorksheetForCurrentUser(supabase, parsed.data)

  if (!worksheet) {
    return localizedFailure("WORKSHEET_ACCESS_DENIED")
  }

  return { ok: true, data: { questionCount: worksheet.question_count } }
}

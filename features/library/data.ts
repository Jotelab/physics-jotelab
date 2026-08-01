import "server-only"

import { cache } from "react"
import { z } from "zod"

import { generationSettingsSchema, worksheetVariantsPayloadSchema } from "@/features/generate/schemas"
import { fetchWorksheetQuestions } from "@/features/generate/utils/fetch-worksheet-questions"
import { attachQuestionDiagrams } from "@/lib/tikz/attach-diagram"
import type { Subject, WorksheetQuestion } from "@/features/generate/types"
import type { LibraryWorksheetDetail, LibraryWorksheetSummary } from "@/features/library/types"
import { mapWorksheetListRowToSummary, type WorksheetListRow } from "@/features/library/map-worksheet-summary"
import { createClient } from "@/lib/supabase/server"

const worksheetIdSchema = z.string().uuid()

type WorksheetDetailRow = {
  id: string
  title: string
  subject: Subject
  question_count: number
  generation_settings: unknown
  variants: unknown
  created_at: string
  updated_at: string
}

function toDetail(
  row: WorksheetDetailRow,
  questions: WorksheetQuestion[]
): LibraryWorksheetDetail {
  const settings = generationSettingsSchema.safeParse(row.generation_settings)
  const variantsPayload = worksheetVariantsPayloadSchema.safeParse(row.variants)

  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    expectedQuestionCount: row.question_count,
    actualQuestionCount: questions.length,
    createdAt: row.created_at,
    questions,
    generationSettings: settings.success ? settings.data : null,
    savedVariants: variantsPayload.success ? variantsPayload.data.saved : [],
    updatedAt: row.updated_at,
  }
}

export const LIBRARY_PAGE_SIZE = 12

export async function getLibraryWorksheets(
  page: number = 1
): Promise<{ worksheets: LibraryWorksheetSummary[]; hasMore: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { worksheets: [], hasMore: false }
  }

  const offset = (page - 1) * LIBRARY_PAGE_SIZE

  // Fetch one extra row to determine whether a next page exists.
  const { data, error } = await supabase
    .from("worksheets")
    .select("id, title, subject, question_count, saved_question_count, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + LIBRARY_PAGE_SIZE)
    .returns<WorksheetListRow[]>()

  if (error || !data) {
    throw new Error("Could not load worksheets")
  }

  const hasMore = data.length > LIBRARY_PAGE_SIZE
  const worksheets = data.slice(0, LIBRARY_PAGE_SIZE).map(mapWorksheetListRowToSummary)

  return { worksheets, hasMore }
}

export const getLibraryWorksheet = cache(async function getLibraryWorksheet(
  worksheetId: string
): Promise<LibraryWorksheetDetail | null> {
  const parsed = worksheetIdSchema.safeParse(worksheetId)

  if (!parsed.success) {
    return null
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from("worksheets")
    .select("id, title, subject, question_count, generation_settings, variants, created_at, updated_at")
    .eq("id", parsed.data)
    .single<WorksheetDetailRow>()

  if (error || !data) {
    return null
  }

  const rawQuestions = await fetchWorksheetQuestions(supabase, data.id)

  if (rawQuestions === null) {
    throw new Error("Could not load worksheet questions")
  }

  // Attach templated diagrams for the saved-worksheet view.
  const questions = await attachQuestionDiagrams(rawQuestions)

  return toDetail(data, questions)
})

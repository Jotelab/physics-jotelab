import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { worksheetQuestionSchema } from "@/features/generate/schemas"
import type { WorksheetQuestion } from "@/features/generate/types"
import { logGenerationError } from "@/lib/ai/generation-errors"

// Validates the raw DB row shape; the question payload (given_values, etc.) is
// validated by worksheetQuestionSchema once mapped, so it is read as unknown here.
const worksheetQuestionRowSchema = z.object({
  id: z.string(),
  worksheet_id: z.string(),
  question_order: z.number(),
  question_text: z.string(),
  given_values: z.unknown(),
  target_variable: z.unknown(),
  solution: z.unknown(),
})

type WorksheetQuestionRow = z.infer<typeof worksheetQuestionRowSchema>

function rowToQuestion(row: WorksheetQuestionRow): unknown {
  return {
    id: row.id,
    order: row.question_order,
    question_text: row.question_text,
    given_values: row.given_values,
    target_variable: row.target_variable,
    solution: row.solution,
  }
}

export async function fetchWorksheetQuestions(
  supabase: SupabaseClient,
  worksheetId: string
): Promise<WorksheetQuestion[] | null> {
  const { data, error } = await supabase
    .from("worksheet_questions")
    .select(
      "id, worksheet_id, question_order, question_text, given_values, target_variable, solution"
    )
    .eq("worksheet_id", worksheetId)
    .order("question_order", { ascending: true })

  if (error || !data) {
    return null
  }

  const rows = z.array(worksheetQuestionRowSchema).safeParse(data)

  if (!rows.success) {
    logGenerationError("fetchWorksheetQuestions", rows.error)
    return null
  }

  const parsed = worksheetQuestionSchema.array().safeParse(rows.data.map(rowToQuestion))

  if (!parsed.success) {
    logGenerationError("fetchWorksheetQuestions", parsed.error)
    return null
  }

  return parsed.data
}

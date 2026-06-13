import type { SupabaseClient } from "@supabase/supabase-js"

import { worksheetQuestionSchema } from "@/features/generate/schemas"
import type { WorksheetQuestion } from "@/features/generate/types"
import { logGenerationError } from "@/lib/ai/generation-errors"

type WorksheetQuestionRow = {
  id: string
  worksheet_id: string
  question_order: number
  question_text: string
  given_values: unknown
  target_variable: unknown
  solution: unknown
}

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

  const rows = data as WorksheetQuestionRow[]
  const parsed = worksheetQuestionSchema.array().safeParse(rows.map(rowToQuestion))

  if (!parsed.success) {
    logGenerationError("fetchWorksheetQuestions", parsed.error)
    return null
  }

  return parsed.data
}

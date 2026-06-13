import type { Subject } from "@/features/generate/types"
import type { LibraryWorksheetSummary } from "@/features/library/types"

export type WorksheetListRow = {
  id: string
  title: string
  subject: Subject
  question_count: number
  saved_question_count: number
  created_at: string
}

export function mapWorksheetListRowToSummary(row: WorksheetListRow): LibraryWorksheetSummary {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    expectedQuestionCount: row.question_count,
    actualQuestionCount: row.saved_question_count,
    createdAt: row.created_at,
  }
}

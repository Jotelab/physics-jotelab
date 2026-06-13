import type { Subject, WorksheetQuestion } from "@/features/generate/types"
import type { WorksheetHeaderConfig } from "@/features/worksheet/types/header"

export type LibraryWorksheetSummary = {
  id: string
  title: string
  subject: Subject
  expectedQuestionCount: number
  actualQuestionCount: number
  createdAt: string
}

export type LibraryWorksheetDetail = LibraryWorksheetSummary & {
  questions: WorksheetQuestion[]
  generationSettings: {
    lesson: string
    scenario: string
    header?: WorksheetHeaderConfig
  } | null
  updatedAt: string
}

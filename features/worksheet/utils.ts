import type { SkippedSlot, WorksheetQuestion } from "@/features/generate/types"

export type WorksheetViewMode = "worksheet" | "answer"

export type DisplayItem =
  | { type: "question"; order: number; question: WorksheetQuestion }
  | { type: "skipped"; order: number; skipped: SkippedSlot }

export function getDisplayItems(
  questions: WorksheetQuestion[],
  skippedSlots: SkippedSlot[]
): DisplayItem[] {
  return [
    ...questions.map((question): DisplayItem => ({
      type: "question",
      order: question.order,
      question,
    })),
    ...skippedSlots.map((skipped): DisplayItem => ({
      type: "skipped",
      order: skipped.order,
      skipped,
    })),
  ].sort((a, b) => a.order - b.order)
}

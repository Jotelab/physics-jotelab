import { z } from "zod"

import type { GenerationProgress, SkippedSlot, WorksheetQuestion } from "./types"

export const generationJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "partial",
  "failed",
  "cancelled",
])

export type GenerationJobStatus = z.infer<typeof generationJobStatusSchema>

export const generationJobKindSchema = z.enum(["initial", "append"])

export type GenerationJobKind = z.infer<typeof generationJobKindSchema>

export type GenerationJobRow = {
  id: string
  user_id: string
  worksheet_id: string
  kind: GenerationJobKind
  status: GenerationJobStatus
  from_order: number
  to_order: number
  last_completed_order: number | null
  skipped_orders: unknown
  error_message: string | null
  inngest_run_id: string | null
  created_at: string
  updated_at: string
}

const skippedOrderSchema = z.object({
  order: z.number().int().min(1),
  message: z.string().min(1),
})

export function parseSkippedOrders(value: unknown): SkippedSlot[] {
  const parsed = z.array(skippedOrderSchema).safeParse(value)
  return parsed.success ? parsed.data : []
}

export type GenerationJobPollResult = {
  jobId: string
  worksheetId: string
  status: GenerationJobStatus
  kind: GenerationJobKind
  fromOrder: number
  toOrder: number
  lastCompletedOrder: number
  targetQuestionCount: number
  progress: GenerationProgress
  questions: WorksheetQuestion[]
  skippedSlots: SkippedSlot[]
  statusMessage: string
  creditBalance: number | null
  isTerminal: boolean
  stoppedForCredits: boolean
}

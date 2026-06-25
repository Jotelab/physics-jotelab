import { z } from "zod"

import type { GenerationProgress, SkippedSlot, VariantLabel, VariantSkippedSlot, WorksheetQuestion, WorksheetVariant } from "./types"
import { worksheetVariantSchema } from "./schemas"

export const generationJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "partial",
  "failed",
  "cancelled",
])

export type GenerationJobStatus = z.infer<typeof generationJobStatusSchema>

export const generationJobKindSchema = z.enum(["initial", "append", "variant"])

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
  variant_labels: VariantLabel[] | null
  variant_results: unknown
  created_at: string
  updated_at: string
}

const skippedOrderSchema = z.object({
  order: z.number().int().min(1),
  message: z.string().min(1),
  label: z.enum(["B", "C", "D"]).optional(),
})

export function parseSkippedOrders(value: unknown): SkippedSlot[] {
  const parsed = z.array(skippedOrderSchema).safeParse(value)
  return parsed.success
    ? parsed.data.map(({ order, message }) => ({ order, message }))
    : []
}

export function parseVariantSkippedOrders(value: unknown): VariantSkippedSlot[] {
  const parsed = z.array(skippedOrderSchema).safeParse(value)
  if (!parsed.success) {
    return []
  }

  return parsed.data.flatMap((slot) =>
    slot.label ? [{ order: slot.order, label: slot.label, message: slot.message }] : []
  )
}

const variantResultsPayloadSchema = z.object({
  variants: z.array(worksheetVariantSchema),
})

export function parseVariantResults(value: unknown): WorksheetVariant[] {
  const parsed = variantResultsPayloadSchema.safeParse(value)
  return parsed.success ? parsed.data.variants : []
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
  variants?: WorksheetVariant[]
  variantSkippedSlots?: VariantSkippedSlot[]
  variantProgress?: GenerationProgress
}

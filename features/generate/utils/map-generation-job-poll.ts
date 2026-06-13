import type { GenerationJobPollResult, GenerationJobRow } from "../generation-job-types"
import { parseSkippedOrders } from "../generation-job-types"
import type { WorksheetQuestion } from "../types"
import { getUnfilledOrders } from "./get-unfilled-orders"

export function buildGenerationJobStatusMessage(
  job: Pick<GenerationJobRow, "status" | "last_completed_order" | "to_order" | "skipped_orders">
): string {
  const lastCompleted = job.last_completed_order ?? 0
  const skipped = parseSkippedOrders(job.skipped_orders)

  switch (job.status) {
    case "queued":
      return "Waiting to start generation..."
    case "running":
      return `Generating ${Math.min(lastCompleted + 1, job.to_order)}/${job.to_order}...`
    case "completed":
      return skipped.length > 0
        ? `Finished with ${skipped.length} skipped question${skipped.length === 1 ? "" : "s"}.`
        : "Worksheet complete."
    case "partial":
      return "Generation stopped because you do not have enough credits."
    case "failed":
      return "Generation failed. Please try again."
    case "cancelled":
      return "Generation was cancelled."
    default:
      return "Generating..."
  }
}

export function mapGenerationJobPoll(params: {
  job: GenerationJobRow
  questions: WorksheetQuestion[]
  questionCount: number
  creditBalance: number | null
}): GenerationJobPollResult {
  const { job, questions, questionCount, creditBalance } = params
  const skippedSlots = parseSkippedOrders(job.skipped_orders)
  const lastCompletedOrder = job.last_completed_order ?? 0
  const isTerminal = ["completed", "partial", "failed", "cancelled"].includes(job.status)
  const stoppedForCredits = job.status === "partial"
  const unfilled = getUnfilledOrders(questions, job.to_order).filter(
    (order) => order >= job.from_order
  )
  const progressCurrent =
    job.status === "completed"
      ? job.to_order
      : Math.max(lastCompletedOrder, questions.length > 0 ? Math.max(...questions.map((q) => q.order)) : 0)

  const statusMessage =
    job.status === "running"
      ? `Generating ${unfilled[0] ?? progressCurrent + 1}/${job.to_order}...`
      : buildGenerationJobStatusMessage(job)

  return {
    jobId: job.id,
    worksheetId: job.worksheet_id,
    status: job.status,
    kind: job.kind,
    fromOrder: job.from_order,
    toOrder: job.to_order,
    lastCompletedOrder,
    targetQuestionCount: questionCount,
    progress: { current: progressCurrent, total: job.to_order },
    questions,
    skippedSlots,
    statusMessage,
    creditBalance,
    isTerminal,
    stoppedForCredits,
  }
}

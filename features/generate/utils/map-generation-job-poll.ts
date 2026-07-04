import type { GenerationJobPollResult, GenerationJobRow } from "../generation-job-types"
import { parseSkippedOrders, parseVariantResults, parseVariantSkippedOrders } from "../generation-job-types"
import type { WorksheetQuestion } from "../types"

function buildVariantJobStatusMessage(
  job: Pick<GenerationJobRow, "status" | "last_completed_order" | "variant_labels" | "to_order" | "skipped_orders">
): string {
  const labels = job.variant_labels ?? []
  const totalRolls = labels.length * job.to_order
  const completedRolls = job.last_completed_order ?? 0
  const skipped = parseVariantSkippedOrders(job.skipped_orders)

  switch (job.status) {
    case "queued":
      return "Waiting to start variant generation..."
    case "running":
      return `Generating variants ${Math.min(completedRolls + 1, totalRolls)}/${totalRolls}...`
    case "completed":
      return skipped.length > 0
        ? `Variants finished with ${skipped.length} skipped roll${skipped.length === 1 ? "" : "s"}.`
        : "Variants complete."
    case "partial":
      return "Variant generation stopped because you do not have enough credits."
    case "failed":
      return "Variant generation failed. Please try again."
    case "cancelled":
      return "Variant generation was cancelled."
    default:
      return "Generating variants..."
  }
}

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

  if (job.kind === "variant") {
    const labels = job.variant_labels ?? []
    const totalRolls = labels.length * job.to_order
    const completedRolls = job.last_completed_order ?? 0
    const variantSkippedSlots = parseVariantSkippedOrders(job.skipped_orders)
    const variants = parseVariantResults(job.variant_results)
    const isTerminal = ["completed", "partial", "failed", "cancelled"].includes(job.status)
    const stoppedForCredits = job.status === "partial"

    return {
      jobId: job.id,
      worksheetId: job.worksheet_id,
      status: job.status,
      kind: job.kind,
      fromOrder: job.from_order,
      toOrder: job.to_order,
      lastCompletedOrder: completedRolls,
      targetQuestionCount: questionCount,
      progress: { current: completedRolls, total: totalRolls },
      questions,
      skippedSlots: [],
      statusMessage: buildVariantJobStatusMessage(job),
      creditBalance,
      isTerminal,
      stoppedForCredits,
      variants,
      variantSkippedSlots,
      variantProgress: { current: completedRolls, total: totalRolls },
    }
  }

  const skippedSlots = parseSkippedOrders(job.skipped_orders)
  const lastCompletedOrder = job.last_completed_order ?? 0
  const isTerminal = ["completed", "partial", "failed", "cancelled"].includes(job.status)
  const stoppedForCredits = job.status === "partial"
  // Progress comes from the job's last_completed_order (kept in lockstep with the
  // saved questions by the worker's persist step), not from the questions array —
  // so `questions` may be an incremental delta rather than the full worksheet.
  const progressCurrent = job.status === "completed" ? job.to_order : lastCompletedOrder

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
    statusMessage: buildGenerationJobStatusMessage(job),
    creditBalance,
    isTerminal,
    stoppedForCredits,
  }
}

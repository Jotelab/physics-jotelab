import type { GenerateQuestionResult } from "@/features/generate/result-types"
import { failure } from "@/features/generate/errors"

import { shouldRetryGeneration } from "@/features/generate/utils/retry-policy"

export const GENERATION_RETRY_DELAY_MS = 1000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type GenerateQuestionFn = (
  order: number,
  previousQuestionsContext: string[]
) => Promise<GenerateQuestionResult>

export function buildPreviousQuestionsContext(
  questions: { order: number; question_text: string }[],
  order: number
): string[] {
  return questions
    .filter((question) => question.order < order)
    .sort((a, b) => a.order - b.order)
    .map((question) => question.question_text)
}

export async function generateQuestionWithRetry(params: {
  order: number
  previousQuestionsContext: string[]
  generateQuestion: GenerateQuestionFn
  onRetryScheduled?: (order: number) => void
}): Promise<GenerateQuestionResult> {
  const { order, previousQuestionsContext, generateQuestion, onRetryScheduled } = params

  let questionResult: GenerateQuestionResult | null = null

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    questionResult = await generateQuestion(order, previousQuestionsContext)

    if (questionResult.ok) {
      break
    }

    if (questionResult.code === "INSUFFICIENT_CREDITS") {
      break
    }

    if (!shouldRetryGeneration(questionResult.code)) {
      break
    }

    if (attempt === 1) {
      onRetryScheduled?.(order)
      await sleep(GENERATION_RETRY_DELAY_MS)
    }
  }

  return questionResult ?? failure("GENERATE_FAILED")
}

export function appendCreditExhaustedSkips(params: {
  fromOrder: number
  toOrder: number
  questions: { order: number }[]
  skippedSlots: { order: number; message: string }[]
}) {
  const { fromOrder, toOrder, questions, skippedSlots } = params
  const filledOrders = new Set(questions.map((question) => question.order))
  const skippedOrders = new Set(skippedSlots.map((slot) => slot.order))
  const newSkips: { order: number; message: string }[] = []

  for (let skippedOrder = fromOrder; skippedOrder <= toOrder; skippedOrder += 1) {
    if (filledOrders.has(skippedOrder) || skippedOrders.has(skippedOrder)) {
      continue
    }

    newSkips.push({
      order: skippedOrder,
      message: `Question ${skippedOrder} was skipped because you do not have enough credits.`,
    })
    skippedOrders.add(skippedOrder)
  }

  return newSkips
}

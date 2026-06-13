import type { WorksheetQuestion } from "@/features/generate/types"

/** Orders in [1, toOrder] that do not yet have a saved question. */
export function getUnfilledOrders(
  questions: WorksheetQuestion[],
  toOrder: number
): number[] {
  if (toOrder < 1) {
    return []
  }

  const filledOrders = new Set(questions.map((question) => question.order))
  const orders: number[] = []

  for (let order = 1; order <= toOrder; order += 1) {
    if (!filledOrders.has(order)) {
      orders.push(order)
    }
  }

  return orders
}

export function getFirstUnfilledOrder(
  questions: WorksheetQuestion[],
  toOrder: number
): number | null {
  return getUnfilledOrders(questions, toOrder)[0] ?? null
}

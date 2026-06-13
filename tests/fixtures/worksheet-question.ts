import type { GeneratedQuestion, WorksheetQuestion } from "@/features/generate/types"

export const validGeneratedQuestion: GeneratedQuestion = {
  question_text: "จงหาค่า $x$",
  given_values: [
    {
      symbol: "a",
      label: "สัมประสิทธิ์",
      value: 2,
    },
  ],
  target_variable: {
    symbol: "x",
    label: "ค่าที่ไม่ทราบ",
  },
  solution: {
    steps: ["แทนค่าและคำนวณ"],
    final_answer: "$x = 5$",
  },
}

export const validWorksheetQuestion: WorksheetQuestion = {
  id: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
  order: 1,
  ...validGeneratedQuestion,
}

export function appendRpcResponse(
  overrides: {
    creditBalance?: number | string
    credit_balance?: number | string
    question?: WorksheetQuestion
  } = {}
) {
  return {
    success: true,
    question: overrides.question ?? validWorksheetQuestion,
    ...(overrides.creditBalance !== undefined ? { creditBalance: overrides.creditBalance } : {}),
    ...(overrides.credit_balance !== undefined ? { credit_balance: overrides.credit_balance } : {}),
  }
}

export function completeFailureRpcResponse(
  overrides: {
    creditBalance?: number | string
    message?: string
    code?: string
  } = {}
) {
  const message = overrides.message ?? "Worksheet not found or already complete"
  const code =
    overrides.code ??
    (message.includes("Worksheet or question not found")
      ? "QUESTION_NOT_FOUND"
      : message.includes("already complete")
        ? "WORKSHEET_ALREADY_COMPLETE"
        : "WORKSHEET_ACCESS_DENIED")

  return {
    success: false,
    code,
    creditBalance: overrides.creditBalance ?? 42,
    message,
  }
}

export const reservationId = "b1b2c3d4-e5f6-4789-a012-3456789abcde"
export const pendingQuestionId = "c1b2c3d4-e5f6-4789-a012-3456789abcde"

export function reserveRpcResponse(creditBalance: number = 41) {
  return {
    reservationId,
    creditBalance,
    pendingQuestionId,
    alreadyCompleted: false,
  }
}

export function reserveAlreadyCompletedResponse(creditBalance: number = 41) {
  return {
    alreadyCompleted: true,
    creditBalance,
    success: true,
    question: validWorksheetQuestion,
  }
}

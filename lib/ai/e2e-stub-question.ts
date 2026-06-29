import type { GeneratedQuestion, VariantLabel, WorksheetQuestion } from "@/features/generate/types"

/** Fixed question returned when E2E_STUB_GENERATION is enabled (no AI call). */
export const e2eStubGeneratedQuestion: GeneratedQuestion = {
  format: "calculation",
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

const variantLabelOffset: Record<VariantLabel, number> = {
  B: 1,
  C: 2,
  D: 3,
}

/** Deterministic variant stub for E2E tests. */
export function e2eStubVariantQuestion(
  masterQuestion: WorksheetQuestion,
  variantLabel: VariantLabel
): GeneratedQuestion {
  const offset = variantLabelOffset[variantLabel] + masterQuestion.order

  return {
    format: "calculation",
    question_text: masterQuestion.question_text,
    given_values: masterQuestion.given_values.map((given) => ({
      ...given,
      value: typeof given.value === "number" ? given.value + offset : given.value,
    })),
    target_variable: masterQuestion.target_variable,
    solution: {
      steps: [`Version ${variantLabel}: แทนค่าและคำนวณ`],
      final_answer: masterQuestion.solution.final_answer,
    },
  }
}

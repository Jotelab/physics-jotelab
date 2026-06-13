import type { GeneratedQuestion } from "@/features/generate/types"

/** Fixed question returned when E2E_STUB_GENERATION is enabled (no AI call). */
export const e2eStubGeneratedQuestion: GeneratedQuestion = {
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

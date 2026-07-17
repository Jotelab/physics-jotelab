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

/**
 * Fixed engine-backed question for E2E when E2E_STUB_GENERATION is enabled —
 * stubs both the engine and the LLM so the neuro-symbolic path (including the
 * `sympy_data` storage round-trip) runs without any network calls (§1.2).
 */
export const e2eStubEngineQuestion: GeneratedQuestion = {
  format: "calculation",
  question_text:
    "รถเริ่มเคลื่อนที่จากหยุดนิ่ง ด้วยความเร่ง 2 m/s² เป็นเวลา 5 วินาที จงหาความเร็วปลาย",
  given_values: [
    { symbol: "v₀", label: "ความเร็วต้น", value: 0, unit: "m/s" },
    { symbol: "a", label: "ความเร่ง", value: 2, unit: "m/s²" },
    { symbol: "t", label: "เวลา", value: 5, unit: "s" },
  ],
  target_variable: { symbol: "v", label: "ความเร็วปลาย", unit: "m/s" },
  solution: {
    steps: ["$v = u + a t$", "$v = 0 + 2 \\cdot 5$", "$v = 10\\ \\text{m/s}$"],
    final_answer: "$10\\ \\text{m/s}$",
  },
  sympy_data: {
    topic: "suvat",
    seed: 1,
    given: [
      { symbol: "u", value: 0, exact: "0", unit: "m/s" },
      { symbol: "a", value: 2, exact: "2", unit: "m/s^2" },
      { symbol: "t", value: 5, exact: "5", unit: "s" },
    ],
    find: { symbol: "v", value: 10, exact: "10", unit: "m/s" },
    steps: [
      {
        expr_latex: "v = u + a t",
        substituted_latex: "v = 0 + 2 \\cdot 5",
        result_latex: "v = 10\\ \\text{m/s}",
      },
    ],
    final_answer: { value: 10, exact: "10", unit: "m/s", latex: "10\\ \\text{m/s}" },
    policy_applied: "easy",
    plausible: true,
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

  const stub: GeneratedQuestion = {
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

  // Mirror the production shape for engine-backed masters: rolls carry a
  // sympy_data payload, so E2E exercises the variant-roll allowlist and storage
  // round-trip. Values are offset like given_values; E2E does not re-derive.
  if (masterQuestion.sympy_data) {
    stub.sympy_data = {
      ...masterQuestion.sympy_data,
      seed: masterQuestion.sympy_data.seed + offset,
      given: masterQuestion.sympy_data.given.map((given) => ({
        ...given,
        value: given.value + offset,
        exact: String(given.value + offset),
      })),
    }
  }

  return stub
}

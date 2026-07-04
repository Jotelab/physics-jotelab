import type { GeneratedQuestion, MathComplexity } from "@/features/generate/types"
import { DEFAULT_MATH_COMPLEXITY } from "@/features/generate/constants/difficulty-settings"

import { formatNumericValue } from "./format-math-complexity"

function omitEmptyUnit(unit: string | undefined) {
  const trimmed = unit?.trim()
  return trimmed ? { unit: trimmed } : {}
}

function coerceValue(value: number | string): number | string {
  if (typeof value === "number") {
    return value
  }

  const trimmed = value.trim()
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed)
  }

  return value
}

function formatGivenValue(value: number | string, mathComplexity: MathComplexity): number | string {
  if (typeof value === "number") {
    return formatNumericValue(value, mathComplexity)
  }

  const coerced = coerceValue(value)
  if (typeof coerced === "number") {
    return formatNumericValue(coerced, mathComplexity)
  }

  return coerced
}

export function normalizeGeneratedQuestion(
  raw: GeneratedQuestion,
  options?: { mathComplexity?: MathComplexity }
): GeneratedQuestion {
  const mathComplexity = options?.mathComplexity ?? DEFAULT_MATH_COMPLEXITY

  return {
    format: raw.format,
    question_text: raw.question_text.trim(),
    given_values: raw.given_values.map((given) => ({
      symbol: given.symbol.trim(),
      label: given.label.trim(),
      value: formatGivenValue(given.value, mathComplexity),
      ...omitEmptyUnit(given.unit),
    })),
    target_variable: {
      symbol: raw.target_variable.symbol.trim(),
      label: raw.target_variable.label.trim(),
      ...omitEmptyUnit(raw.target_variable.unit),
    },
    solution: {
      steps: raw.solution.steps.map((step) => step.trim()).filter((step) => step.length > 0),
      final_answer: raw.solution.final_answer.trim(),
    },
  }
}

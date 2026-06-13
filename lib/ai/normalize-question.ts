import type { GeneratedQuestion } from "@/features/generate/types"

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

export function normalizeGeneratedQuestion(raw: GeneratedQuestion): GeneratedQuestion {
  return {
    question_text: raw.question_text.trim(),
    given_values: raw.given_values.map((given) => ({
      symbol: given.symbol.trim(),
      label: given.label.trim(),
      value: coerceValue(given.value),
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

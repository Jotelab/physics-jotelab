import type { GenerateWorksheetInput } from "./types"
import {
  DEFAULT_CONCEPTUAL_DIFFICULTY,
  DEFAULT_MATH_COMPLEXITY,
} from "./constants/difficulty-settings"

export function getWorksheetTitle(input: GenerateWorksheetInput) {
  const subjectLabel = input.subject[0].toUpperCase() + input.subject.slice(1)
  return `${subjectLabel}: ${input.lesson}`
}

export function buildGenerationSettingsPayload(input: GenerateWorksheetInput) {
  const payload: {
    lesson: string
    scenario: string
    given_variables?: GenerateWorksheetInput["given_variables"]
    target_variables?: GenerateWorksheetInput["target_variables"]
    target_randomize?: boolean
    math_complexity: GenerateWorksheetInput["math_complexity"]
    conceptual_difficulty: GenerateWorksheetInput["conceptual_difficulty"]
  } = {
    lesson: input.lesson,
    scenario: input.scenario,
    math_complexity: input.math_complexity ?? DEFAULT_MATH_COMPLEXITY,
    conceptual_difficulty: input.conceptual_difficulty ?? DEFAULT_CONCEPTUAL_DIFFICULTY,
  }

  if (input.given_variables && input.given_variables.length > 0) {
    payload.given_variables = input.given_variables
  }

  if (input.target_variables && input.target_variables.length > 0) {
    payload.target_variables = input.target_variables
  }

  if (input.target_randomize) {
    payload.target_randomize = true
  }

  return payload
}

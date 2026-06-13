import type { GenerateWorksheetInput } from "./types"

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
  } = {
    lesson: input.lesson,
    scenario: input.scenario,
  }

  if (input.given_variables && input.given_variables.length > 0) {
    payload.given_variables = input.given_variables
  }

  if (input.target_variables && input.target_variables.length > 0) {
    payload.target_variables = input.target_variables
  }

  return payload
}

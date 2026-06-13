import type { GivenVariable, TargetVariable } from "@/features/generate/types"

function formatGivenVariable(variable: GivenVariable) {
  const valuePart =
    variable.value === "" || variable.value === null || variable.value === undefined
      ? variable.symbol
      : `${variable.symbol} = ${variable.value}${variable.unit ? ` ${variable.unit}` : ""}`

  return `${valuePart} (${variable.label})`
}

function formatTargetVariable(variable: TargetVariable) {
  const unitPart = variable.unit ? `, ${variable.unit}` : ""
  return `${variable.symbol} (${variable.label}${unitPart})`
}

export function buildScenarioPrompt(
  baseScenario: string,
  givenVariables?: GivenVariable[],
  targetVariables?: TargetVariable[]
) {
  const trimmedBase = baseScenario.trim()
  const parts: string[] = []

  if (givenVariables && givenVariables.length > 0) {
    parts.push(`Given: ${givenVariables.map(formatGivenVariable).join(", ")}.`)
  }

  if (targetVariables && targetVariables.length > 0) {
    parts.push(`Find: ${targetVariables.map(formatTargetVariable).join(", ")}.`)
  }

  if (parts.length === 0) {
    return trimmedBase
  }

  if (!trimmedBase) {
    return parts.join(" ")
  }

  return `${trimmedBase}\n\n${parts.join(" ")}`
}

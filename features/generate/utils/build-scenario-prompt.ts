import type { GivenVariable, TargetVariable, ConceptualDifficulty } from "@/features/generate/types"
import {
  CONCEPTUAL_DIFFICULTY_PROMPTS,
  DEFAULT_CONCEPTUAL_DIFFICULTY,
} from "@/features/generate/constants/difficulty-settings"

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

export type ScenarioPromptOptions = {
  pool?: TargetVariable[]
  mode?: "rotate" | "random"
  conceptualDifficulty?: ConceptualDifficulty
}

export function buildScenarioPrompt(
  baseScenario: string,
  givenVariables?: GivenVariable[],
  activeTarget?: TargetVariable,
  options?: ScenarioPromptOptions
) {
  const trimmedBase = baseScenario.trim()
  const parts: string[] = []

  if (givenVariables && givenVariables.length > 0) {
    parts.push(`Given: ${givenVariables.map(formatGivenVariable).join(", ")}.`)
  }

  if (activeTarget) {
    parts.push(`Find: ${formatTargetVariable(activeTarget)}.`)
  }

  const pool = options?.pool ?? []
  if (pool.length > 1 && activeTarget) {
    const poolLabels = pool.map(formatTargetVariable).join(", ")
    const modeLabel = options?.mode === "random" ? "random" : "rotate"
    parts.push(
      `Worksheet target pool (${modeLabel} across questions): ${poolLabels}. For this question, find ${activeTarget.symbol}.`
    )
  }

  const difficulty = options?.conceptualDifficulty ?? DEFAULT_CONCEPTUAL_DIFFICULTY
  parts.push(`Difficulty instructions: ${CONCEPTUAL_DIFFICULTY_PROMPTS[difficulty]}`)

  if (parts.length === 0) {
    return trimmedBase
  }

  if (!trimmedBase) {
    return parts.join(" ")
  }

  return `${trimmedBase}\n\n${parts.join(" ")}`
}

import { z } from "zod"

import {
  getVariablePresets,
  resolveLessonKey,
} from "@/features/generate/data/generation-presets"
import { getFindPool } from "@/features/generate/data/variable-compatibility"
import { generationSettingsSchema } from "@/features/generate/schemas"
import type { TargetVariable } from "@/features/generate/types"

type GenerationSettings = z.infer<typeof generationSettingsSchema>

function hashString(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }
  return hash
}

function presetToTargetVariable(presetId: string): TargetVariable | undefined {
  const preset = getVariablePresets().find((item) => item.id === presetId)
  if (!preset) return undefined

  const variable: TargetVariable = {
    symbol: preset.symbol,
    label: preset.label,
  }

  if (preset.unit) {
    variable.unit = preset.unit
  }

  return variable
}

export function getTargetPoolFromSettings(settings: GenerationSettings): TargetVariable[] {
  if (settings.target_variables && settings.target_variables.length > 0) {
    return settings.target_variables
  }

  if (!settings.target_randomize) {
    return []
  }

  const { lessonId, isPreset } = resolveLessonKey(settings.lesson)
  if (!isPreset || !lessonId) {
    return getVariablePresets().map((preset) => ({
      symbol: preset.symbol,
      label: preset.label,
      ...(preset.unit ? { unit: preset.unit } : {}),
    }))
  }

  const poolIds = getFindPool(settings.lesson, [], true)
  return poolIds
    .map((id) => presetToTargetVariable(id))
    .filter((variable): variable is TargetVariable => Boolean(variable))
}

export function resolveQuestionTarget(
  settings: GenerationSettings,
  order: number,
  worksheetId: string
): TargetVariable | undefined {
  const pool = getTargetPoolFromSettings(settings)
  if (pool.length === 0) return undefined

  const index = settings.target_randomize
    ? hashString(`${worksheetId}:${order}`) % pool.length
    : (order - 1) % pool.length

  return pool[index]
}

export function getTargetPoolSymbols(settings: GenerationSettings): string[] {
  return getTargetPoolFromSettings(settings).map((variable) => variable.symbol)
}

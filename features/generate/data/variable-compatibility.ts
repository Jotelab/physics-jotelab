import type { LessonPresetId } from "@/features/generate/data/generation-presets"
import {
  getVariablesForLesson,
  resolveLessonKey,
} from "@/features/generate/data/generation-presets"

const GIVEN_CANDIDATES_BY_LESSON_AND_FIND: Record<
  LessonPresetId,
  Record<string, string[]>
> = {
  "motion-1d": {
    "phys-v": ["phys-v0", "phys-a", "phys-t", "phys-s"],
    "phys-v0": ["phys-v", "phys-a", "phys-t", "phys-s"],
    "phys-a": ["phys-v", "phys-v0", "phys-t", "phys-s"],
    "phys-t": ["phys-v", "phys-v0", "phys-a", "phys-s"],
    "phys-s": ["phys-v", "phys-v0", "phys-a", "phys-t"],
  },
  "newtons-laws": {
    "phys-f": ["phys-m", "phys-a"],
    "phys-m": ["phys-f", "phys-a"],
    "phys-a": ["phys-f", "phys-m"],
  },
  "energy-work": {
    "phys-ek": ["phys-m", "phys-v", "phys-ep", "phys-s", "phys-f"],
    "phys-ep": ["phys-m", "phys-s", "phys-ek", "phys-v", "phys-f"],
    "phys-f": ["phys-m", "phys-s", "phys-ek", "phys-ep", "phys-v"],
    "phys-m": ["phys-v", "phys-ek", "phys-ep", "phys-f", "phys-s"],
    "phys-v": ["phys-m", "phys-ek", "phys-ep", "phys-f", "phys-s"],
    "phys-s": ["phys-f", "phys-m", "phys-ep", "phys-ek", "phys-v"],
  },
  "circular-motion": {
    "phys-v": ["phys-a", "phys-r", "phys-f", "phys-m", "phys-t"],
    "phys-a": ["phys-v", "phys-r", "phys-f", "phys-m", "phys-t"],
    "phys-r": ["phys-v", "phys-a", "phys-f", "phys-m", "phys-t"],
    "phys-f": ["phys-m", "phys-a", "phys-r", "phys-v", "phys-t"],
    "phys-m": ["phys-f", "phys-a", "phys-r", "phys-v", "phys-t"],
    "phys-t": ["phys-v", "phys-a", "phys-r", "phys-f", "phys-m"],
  },
  "momentum-collisions": {
    "phys-p": ["phys-m", "phys-v", "phys-f", "phys-t"],
    "phys-m": ["phys-p", "phys-v", "phys-f", "phys-t"],
    "phys-v": ["phys-p", "phys-m", "phys-f", "phys-t"],
    "phys-f": ["phys-p", "phys-m", "phys-v", "phys-t"],
    "phys-t": ["phys-p", "phys-m", "phys-v", "phys-f"],
  },
  "waves-oscillations": {
    "phys-v": ["phys-t", "phys-s"],
    "phys-t": ["phys-v", "phys-s"],
    "phys-s": ["phys-v", "phys-t"],
  },
  electrostatics: {
    "phys-q": ["phys-f", "phys-r"],
    "phys-f": ["phys-q", "phys-r"],
    "phys-r": ["phys-q", "phys-f"],
  },
  "magnetic-fields": {
    "phys-q": ["phys-f", "phys-v", "phys-r"],
    "phys-f": ["phys-q", "phys-v", "phys-r"],
    "phys-v": ["phys-q", "phys-f", "phys-r"],
    "phys-r": ["phys-q", "phys-f", "phys-v"],
  },
}

function lessonVariableIds(lesson: string): string[] {
  return getVariablesForLesson(lesson).map((preset) => preset.id)
}

export function getFindPool(
  lesson: string,
  findVariableIds: string[],
  targetRandomize: boolean
): string[] {
  const lessonVars = lessonVariableIds(lesson)
  const scoped = findVariableIds.filter((id) => lessonVars.includes(id))
  if (scoped.length > 0) return scoped
  if (targetRandomize) return lessonVars
  return []
}

export function getCompatibleGivenIds(
  lesson: string,
  findVariableIds: string[],
  targetRandomize: boolean
): string[] {
  const lessonVars = lessonVariableIds(lesson)
  const lessonVarSet = new Set(lessonVars)
  const findSet = new Set(findVariableIds.filter((id) => lessonVarSet.has(id)))

  if (findSet.size === 0) {
    return targetRandomize ? lessonVars : []
  }

  const { lessonId, isPreset } = resolveLessonKey(lesson)
  const compatible = new Set<string>()

  if (!isPreset || !lessonId) {
    for (const id of lessonVars) {
      if (!findSet.has(id)) compatible.add(id)
    }
    return [...compatible]
  }

  const lessonMap = GIVEN_CANDIDATES_BY_LESSON_AND_FIND[lessonId]

  for (const findId of findSet) {
    const candidates = lessonMap[findId] ?? []
    for (const id of candidates) {
      if (lessonVarSet.has(id) && !findSet.has(id)) {
        compatible.add(id)
      }
    }
  }

  return [...compatible]
}

export function getIncompatibleGivenIds(
  lesson: string,
  findVariableIds: string[],
  targetRandomize: boolean
): string[] {
  const lessonVars = lessonVariableIds(lesson)
  const findSet = new Set(findVariableIds)
  const compatible = new Set(getCompatibleGivenIds(lesson, findVariableIds, targetRandomize))

  return lessonVars.filter((id) => !findSet.has(id) && !compatible.has(id))
}

export function shouldShowGivenSection(
  findVariableIds: string[],
  targetRandomize: boolean
): boolean {
  return findVariableIds.length > 0 || targetRandomize
}

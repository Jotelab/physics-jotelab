import { getSubjectContentPack } from "@/features/generate/data/subject-content-packs"
import {
  getVariablesForLesson,
  resolveLessonKey,
} from "@/features/generate/data/generation-presets"
import { DEFAULT_SUBJECT } from "@/features/generate/schemas"
import type { Subject } from "@/features/generate/types"

function lessonVariableIds(lesson: string, subject: Subject): string[] {
  return getVariablesForLesson(lesson, subject).map((preset) => preset.id)
}

export function getFindPool(
  lesson: string,
  findVariableIds: string[],
  targetRandomize: boolean,
  subject: Subject = DEFAULT_SUBJECT
): string[] {
  const lessonVars = lessonVariableIds(lesson, subject)
  const scoped = findVariableIds.filter((id) => lessonVars.includes(id))
  if (scoped.length > 0) return scoped
  if (targetRandomize) return lessonVars
  return []
}

export function getCompatibleGivenIds(
  lesson: string,
  findVariableIds: string[],
  targetRandomize: boolean,
  subject: Subject = DEFAULT_SUBJECT
): string[] {
  const lessonVars = lessonVariableIds(lesson, subject)
  const lessonVarSet = new Set(lessonVars)
  const findSet = new Set(findVariableIds.filter((id) => lessonVarSet.has(id)))

  if (findSet.size === 0) {
    return targetRandomize ? lessonVars : []
  }

  const { lessonId, isPreset } = resolveLessonKey(lesson, subject)
  const compatible = new Set<string>()

  if (!isPreset || !lessonId) {
    for (const id of lessonVars) {
      if (!findSet.has(id)) compatible.add(id)
    }
    return [...compatible]
  }

  const lessonMap = getSubjectContentPack(subject).givenCandidatesByLessonAndFind[lessonId] ?? {}

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
  targetRandomize: boolean,
  subject: Subject = DEFAULT_SUBJECT
): string[] {
  const lessonVars = lessonVariableIds(lesson, subject)
  const findSet = new Set(findVariableIds)
  const compatible = new Set(
    getCompatibleGivenIds(lesson, findVariableIds, targetRandomize, subject)
  )

  return lessonVars.filter((id) => !findSet.has(id) && !compatible.has(id))
}

export function shouldShowGivenSection(
  findVariableIds: string[],
  targetRandomize: boolean
): boolean {
  return findVariableIds.length > 0 || targetRandomize
}

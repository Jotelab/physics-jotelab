import {
  FALLBACK_LESSON_KEY,
  type ScenarioContent,
  type SubjectContentPack,
  type VariablePreset,
} from "@/features/generate/data/content-pack"
import { getSubjectContentPack } from "@/features/generate/data/subject-content-packs"
import { getCompatibleGivenIds } from "@/features/generate/data/variable-compatibility"
import { DEFAULT_SUBJECT } from "@/features/generate/schemas"
import type { Subject } from "@/features/generate/types"

export type { ScenarioContent, VariablePreset } from "@/features/generate/data/content-pack"

/**
 * Lesson ids are subject-scoped, so the public type is an opaque string. The
 * strongly-typed per-subject unions live inside each content pack (e.g.
 * `PhysicsLessonId`).
 */
export type LessonPresetId = string

export type LessonPreset = {
  id: LessonPresetId
}

export type ScenarioPreset = {
  id: string
  lessonId: LessonPresetId | typeof FALLBACK_LESSON_KEY
  index: number
}

export type ResolvedLessonKey = {
  lessonId: LessonPresetId | null
  isPreset: boolean
  isCustom: boolean
}

export type VariableRow = {
  id: string
  symbol: string
  label: string
  unit: string
  value: string
}

// Backward-compatible default-subject views of the catalog. New code should
// prefer the subject-parameterized accessors below.
const defaultPack = getSubjectContentPack(DEFAULT_SUBJECT)

export const LESSON_PRESET_IDS = defaultPack.lessonIds
export const LESSON_PRESETS: LessonPreset[] = defaultPack.lessonIds.map((id) => ({ id }))
export const LESSON_LABELS_EN: Record<string, string> = defaultPack.lessonLabelsEn
export const VARIABLE_PRESETS: VariablePreset[] = defaultPack.variablePresets

const legacyLabelToIdCache = new WeakMap<SubjectContentPack, Record<string, string>>()

function legacyLabelToId(pack: SubjectContentPack): Record<string, string> {
  const cached = legacyLabelToIdCache.get(pack)
  if (cached) return cached
  const map = Object.fromEntries(
    Object.entries(pack.lessonLabelsEn).map(([id, label]) => [label, id])
  )
  legacyLabelToIdCache.set(pack, map)
  return map
}

function buildScenarios(
  pack: SubjectContentPack,
  subject: Subject,
  lessonKey: string,
  items: ScenarioContent[]
): ScenarioPreset[] {
  return items.map((_, index) => ({
    id: `${subject}-${lessonKey}-${index + 1}`,
    lessonId: lessonKey,
    index: index + 1,
  }))
}

function isLessonPresetId(pack: SubjectContentPack, value: string): boolean {
  return (pack.lessonIds as readonly string[]).includes(value)
}

export function resolveLessonKey(
  lesson: string,
  subject: Subject = DEFAULT_SUBJECT
): ResolvedLessonKey {
  const trimmed = lesson.trim()
  if (!trimmed) {
    return { lessonId: null, isPreset: false, isCustom: false }
  }

  const pack = getSubjectContentPack(subject)

  if (isLessonPresetId(pack, trimmed)) {
    return { lessonId: trimmed, isPreset: true, isCustom: false }
  }

  const legacyId = legacyLabelToId(pack)[trimmed]
  if (legacyId) {
    return { lessonId: legacyId, isPreset: true, isCustom: false }
  }

  return { lessonId: null, isPreset: false, isCustom: true }
}

export function getLessonPresets(subject: Subject = DEFAULT_SUBJECT): LessonPreset[] {
  return getSubjectContentPack(subject).lessonIds.map((id) => ({ id }))
}

export function getLessonLabel(
  lessonId: LessonPresetId,
  subject: Subject = DEFAULT_SUBJECT
): string {
  return getSubjectContentPack(subject).lessonLabelsEn[lessonId] ?? lessonId
}

export function getScenarioLabel(
  preset: ScenarioPreset,
  subject: Subject = DEFAULT_SUBJECT
): string {
  const pack = getSubjectContentPack(subject)
  return pack.scenarioContent[preset.lessonId]?.[preset.index - 1]?.label ?? ""
}

export function getScenarioDescription(
  lesson: string,
  scenarioId: string,
  subject: Subject = DEFAULT_SUBJECT
): string {
  const scenario = findScenarioById(lesson, scenarioId, subject)
  if (!scenario) return ""
  const pack = getSubjectContentPack(subject)
  return pack.scenarioContent[scenario.lessonId]?.[scenario.index - 1]?.description ?? ""
}

export function getScenariosForLesson(
  lesson: string,
  subject: Subject = DEFAULT_SUBJECT
): { scenarios: ScenarioPreset[]; isFallback: boolean } {
  const pack = getSubjectContentPack(subject)
  const { lessonId, isPreset } = resolveLessonKey(lesson, subject)
  if (isPreset && lessonId) {
    const items = pack.scenarioContent[lessonId]
    if (items && items.length > 0) {
      return { scenarios: buildScenarios(pack, subject, lessonId, items), isFallback: false }
    }
  }
  const fallbackItems = pack.scenarioContent[FALLBACK_LESSON_KEY] ?? []
  return {
    scenarios: buildScenarios(pack, subject, FALLBACK_LESSON_KEY, fallbackItems),
    isFallback: true,
  }
}

export const FALLBACK_SCENARIOS: ScenarioPreset[] = buildScenarios(
  defaultPack,
  DEFAULT_SUBJECT,
  FALLBACK_LESSON_KEY,
  defaultPack.scenarioContent[FALLBACK_LESSON_KEY] ?? []
)

export function findScenarioById(
  lesson: string,
  scenarioId: string,
  subject: Subject = DEFAULT_SUBJECT
): ScenarioPreset | undefined {
  const { scenarios } = getScenariosForLesson(lesson, subject)
  return scenarios.find((scenario) => scenario.id === scenarioId)
}

export function getVariablePresets(subject: Subject = DEFAULT_SUBJECT): VariablePreset[] {
  return getSubjectContentPack(subject).variablePresets
}

export function getVariablesForLesson(
  lesson: string,
  subject: Subject = DEFAULT_SUBJECT
): VariablePreset[] {
  const trimmed = lesson.trim()
  if (!trimmed) return []

  const pack = getSubjectContentPack(subject)
  const { lessonId, isPreset } = resolveLessonKey(lesson, subject)
  if (!isPreset || !lessonId) {
    return pack.variablePresets
  }

  const byId = new Map(pack.variablePresets.map((preset) => [preset.id, preset]))
  const allowedIds = pack.variableIdsByLesson[lessonId] ?? []
  return allowedIds
    .map((id) => byId.get(id))
    .filter((preset): preset is VariablePreset => Boolean(preset))
}

export function pruneVariableSelection(
  lesson: string,
  givenVariableIds: string[],
  findVariableIds: string[],
  targetRandomize: boolean,
  subject: Subject = DEFAULT_SUBJECT
): { givenVariableIds: string[]; findVariableIds: string[] } {
  const lessonVarSet = new Set(getVariablesForLesson(lesson, subject).map((preset) => preset.id))
  const scopedFind = findVariableIds.filter((id) => lessonVarSet.has(id))
  const scopedFindSet = new Set(scopedFind)
  const compatible = new Set(
    getCompatibleGivenIds(lesson, scopedFind, targetRandomize, subject)
  )

  return {
    findVariableIds: scopedFind,
    givenVariableIds: givenVariableIds.filter(
      (id) => compatible.has(id) && !scopedFindSet.has(id)
    ),
  }
}

export function toVariableRows(
  givenVariableIds: string[],
  findVariableIds: string[],
  subject: Subject = DEFAULT_SUBJECT
): { given: VariableRow[]; target: VariableRow[] } {
  const presets = getVariablePresets(subject)
  const byId = new Map(presets.map((p) => [p.id, p]))

  const given = givenVariableIds
    .map((id) => byId.get(id))
    .filter((p): p is VariablePreset => Boolean(p))
    .map((p) => ({
      id: p.id,
      symbol: p.symbol,
      label: p.label,
      unit: p.unit ?? "",
      value: p.defaultValue != null ? String(p.defaultValue) : "",
    }))

  const target = findVariableIds
    .map((id) => byId.get(id))
    .filter((p): p is VariablePreset => Boolean(p))
    .map((p) => ({
      id: p.id,
      symbol: p.symbol,
      label: p.label,
      unit: p.unit ?? "",
      value: "",
    }))

  return { given, target }
}

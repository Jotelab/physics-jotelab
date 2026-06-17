import { getCompatibleGivenIds } from "@/features/generate/data/variable-compatibility"

export const LESSON_PRESET_IDS = [
  "motion-1d",
  "newtons-laws",
  "energy-work",
  "circular-motion",
  "momentum-collisions",
  "waves-oscillations",
  "electrostatics",
  "magnetic-fields",
] as const

export type LessonPresetId = (typeof LESSON_PRESET_IDS)[number]

export type LessonPreset = {
  id: LessonPresetId
}

export type ScenarioPreset = {
  id: string
  lessonId: LessonPresetId | "fallback"
  index: number
}

export type VariablePreset = {
  id: string
  symbol: string
  label: string
  unit?: string
  defaultValue?: string | number
}

export type ResolvedLessonKey = {
  lessonId: LessonPresetId | null
  isPreset: boolean
  isCustom: boolean
}

export const LESSON_PRESETS: LessonPreset[] = LESSON_PRESET_IDS.map((id) => ({ id }))

export const LESSON_LABELS_EN: Record<LessonPresetId, string> = {
  "motion-1d": "Motion in one dimension",
  "newtons-laws": "Newton's laws",
  "energy-work": "Energy & work",
  "circular-motion": "Circular motion",
  "momentum-collisions": "Momentum & collisions",
  "waves-oscillations": "Waves & oscillations",
  electrostatics: "Electrostatics",
  "magnetic-fields": "Magnetic fields",
}

const LEGACY_LESSON_LABEL_TO_ID = Object.fromEntries(
  Object.entries(LESSON_LABELS_EN).map(([id, label]) => [label, id])
) as Record<string, LessonPresetId>

type ScenarioContent = {
  label: string
  description: string
}

const SCENARIO_CONTENT: Record<LessonPresetId | "fallback", ScenarioContent[]> = {
  "motion-1d": [
    {
      label: "Find final velocity",
      description: "Find final velocity given initial velocity, acceleration, and time.",
    },
    {
      label: "Find displacement",
      description: "Find displacement given initial velocity, acceleration, and time.",
    },
    {
      label: "Find acceleration",
      description: "Find acceleration given initial velocity, final velocity, and time.",
    },
    {
      label: "Find time",
      description: "Find time required to reach a given velocity under constant acceleration.",
    },
  ],
  "newtons-laws": [
    { label: "Find net force", description: "Find net force given mass and acceleration (F = ma)." },
    { label: "Find acceleration", description: "Find acceleration from applied forces and mass." },
    {
      label: "Friction on a surface",
      description: "Solve a problem involving kinetic or static friction.",
    },
    { label: "Inclined plane", description: "Analyze forces on an object on an inclined plane." },
  ],
  "energy-work": [
    { label: "Kinetic energy", description: "Calculate kinetic energy from mass and speed." },
    {
      label: "Gravitational PE",
      description: "Calculate gravitational potential energy near Earth's surface.",
    },
    { label: "Work done", description: "Calculate work done by a constant force over a displacement." },
    {
      label: "Conservation of energy",
      description: "Use conservation of mechanical energy to find an unknown.",
    },
  ],
  "circular-motion": [
    {
      label: "Centripetal acceleration",
      description: "Find centripetal acceleration from speed and radius.",
    },
    { label: "Centripetal force", description: "Find centripetal force required for circular motion." },
    {
      label: "Period and frequency",
      description: "Relate period, frequency, and angular speed for uniform circular motion.",
    },
    { label: "Banked curve", description: "Analyze forces on a vehicle moving around a banked curve." },
  ],
  "momentum-collisions": [
    { label: "Momentum", description: "Calculate momentum from mass and velocity." },
    { label: "Elastic collision", description: "Solve a one-dimensional elastic collision problem." },
    { label: "Inelastic collision", description: "Solve a perfectly inelastic collision problem." },
    { label: "Impulse", description: "Relate impulse to change in momentum." },
  ],
  "waves-oscillations": [
    { label: "Wave speed", description: "Find wave speed from frequency and wavelength." },
    {
      label: "Simple harmonic period",
      description: "Find the period of a mass-spring or simple pendulum system.",
    },
    {
      label: "Standing waves",
      description: "Determine wavelength or frequency for a standing wave on a string.",
    },
    { label: "Doppler effect", description: "Calculate observed frequency using the Doppler effect." },
  ],
  electrostatics: [
    { label: "Coulomb force", description: "Calculate electrostatic force between two point charges." },
    { label: "Electric field", description: "Find electric field strength at a point due to charges." },
    { label: "Electric potential", description: "Calculate electric potential or potential difference." },
    { label: "Capacitor energy", description: "Find energy stored in a capacitor or charge on plates." },
  ],
  "magnetic-fields": [
    {
      label: "Magnetic force on wire",
      description: "Find magnetic force on a current-carrying wire in a field.",
    },
    {
      label: "Force on moving charge",
      description: "Calculate magnetic force on a moving charged particle.",
    },
    { label: "Induced EMF", description: "Apply Faraday's law to find induced EMF." },
    { label: "Solenoid field", description: "Estimate magnetic field inside a solenoid." },
  ],
  fallback: [
    {
      label: "Find final velocity",
      description: "Find final velocity given initial velocity, acceleration, and time.",
    },
    { label: "Find force", description: "Find force using Newton's second law or related principles." },
    {
      label: "Energy calculation",
      description: "Calculate kinetic or potential energy in a physical system.",
    },
    { label: "Unit conversion", description: "Convert physical quantities between SI units and solve." },
  ],
}

function lessonScenarios(
  lessonId: LessonPresetId | "fallback",
  items: ScenarioContent[]
): ScenarioPreset[] {
  const slug = lessonId
  return items.map((_, index) => ({
    id: `physics-${slug}-${index + 1}`,
    lessonId,
    index: index + 1,
  }))
}

const SCENARIOS_BY_LESSON_ID: Record<LessonPresetId, ScenarioPreset[]> = {
  "motion-1d": lessonScenarios("motion-1d", SCENARIO_CONTENT["motion-1d"]),
  "newtons-laws": lessonScenarios("newtons-laws", SCENARIO_CONTENT["newtons-laws"]),
  "energy-work": lessonScenarios("energy-work", SCENARIO_CONTENT["energy-work"]),
  "circular-motion": lessonScenarios("circular-motion", SCENARIO_CONTENT["circular-motion"]),
  "momentum-collisions": lessonScenarios("momentum-collisions", SCENARIO_CONTENT["momentum-collisions"]),
  "waves-oscillations": lessonScenarios("waves-oscillations", SCENARIO_CONTENT["waves-oscillations"]),
  electrostatics: lessonScenarios("electrostatics", SCENARIO_CONTENT.electrostatics),
  "magnetic-fields": lessonScenarios("magnetic-fields", SCENARIO_CONTENT["magnetic-fields"]),
}

export const FALLBACK_SCENARIOS: ScenarioPreset[] = lessonScenarios("fallback", SCENARIO_CONTENT.fallback)

export const VARIABLE_PRESETS: VariablePreset[] = [
  { id: "phys-v", symbol: "v", label: "final velocity", unit: "m/s" },
  { id: "phys-v0", symbol: "v₀", label: "initial velocity", unit: "m/s", defaultValue: 0 },
  { id: "phys-a", symbol: "a", label: "acceleration", unit: "m/s²" },
  { id: "phys-t", symbol: "t", label: "time", unit: "s" },
  { id: "phys-s", symbol: "s", label: "displacement", unit: "m" },
  { id: "phys-f", symbol: "F", label: "force", unit: "N" },
  { id: "phys-m", symbol: "m", label: "mass", unit: "kg" },
  { id: "phys-ek", symbol: "Eₖ", label: "kinetic energy", unit: "J" },
  { id: "phys-ep", symbol: "Eₚ", label: "potential energy", unit: "J" },
  { id: "phys-p", symbol: "p", label: "momentum", unit: "kg·m/s" },
  { id: "phys-r", symbol: "r", label: "radius", unit: "m" },
  { id: "phys-q", symbol: "q", label: "charge", unit: "C" },
]

const VARIABLE_IDS_BY_LESSON_ID: Record<LessonPresetId, string[]> = {
  "motion-1d": ["phys-v", "phys-v0", "phys-a", "phys-t", "phys-s"],
  "newtons-laws": ["phys-f", "phys-m", "phys-a"],
  "energy-work": ["phys-ek", "phys-ep", "phys-f", "phys-m", "phys-v", "phys-s"],
  "circular-motion": ["phys-v", "phys-a", "phys-r", "phys-f", "phys-m", "phys-t"],
  "momentum-collisions": ["phys-p", "phys-m", "phys-v", "phys-f", "phys-t"],
  "waves-oscillations": ["phys-v", "phys-t", "phys-s"],
  electrostatics: ["phys-q", "phys-f", "phys-r"],
  "magnetic-fields": ["phys-q", "phys-f", "phys-v", "phys-r"],
}

const VARIABLE_PRESET_BY_ID = new Map(VARIABLE_PRESETS.map((preset) => [preset.id, preset]))

function isLessonPresetId(value: string): value is LessonPresetId {
  return (LESSON_PRESET_IDS as readonly string[]).includes(value)
}

export function resolveLessonKey(lesson: string): ResolvedLessonKey {
  const trimmed = lesson.trim()
  if (!trimmed) {
    return { lessonId: null, isPreset: false, isCustom: false }
  }

  if (isLessonPresetId(trimmed)) {
    return { lessonId: trimmed, isPreset: true, isCustom: false }
  }

  const legacyId = LEGACY_LESSON_LABEL_TO_ID[trimmed]
  if (legacyId) {
    return { lessonId: legacyId, isPreset: true, isCustom: false }
  }

  return { lessonId: null, isPreset: false, isCustom: true }
}

export function getLessonPresets(): LessonPreset[] {
  return LESSON_PRESETS
}

export function getLessonLabel(lessonId: LessonPresetId): string {
  return LESSON_LABELS_EN[lessonId]
}

export function getScenarioLabel(preset: ScenarioPreset): string {
  return SCENARIO_CONTENT[preset.lessonId][preset.index - 1]?.label ?? ""
}

export function getScenarioDescription(lesson: string, scenarioId: string): string {
  const scenario = findScenarioById(lesson, scenarioId)
  if (!scenario) return ""
  return SCENARIO_CONTENT[scenario.lessonId][scenario.index - 1]?.description ?? ""
}

export function getScenariosForLesson(
  lesson: string
): { scenarios: ScenarioPreset[]; isFallback: boolean } {
  const { lessonId, isPreset } = resolveLessonKey(lesson)
  if (isPreset && lessonId) {
    const scenarios = SCENARIOS_BY_LESSON_ID[lessonId]
    if (scenarios.length > 0) {
      return { scenarios, isFallback: false }
    }
  }
  return { scenarios: FALLBACK_SCENARIOS, isFallback: true }
}

export function findScenarioById(
  lesson: string,
  scenarioId: string
): ScenarioPreset | undefined {
  const { scenarios } = getScenariosForLesson(lesson)
  return scenarios.find((scenario) => scenario.id === scenarioId)
}

export function getVariablePresets(): VariablePreset[] {
  return VARIABLE_PRESETS
}

export function getVariablesForLesson(lesson: string): VariablePreset[] {
  const trimmed = lesson.trim()
  if (!trimmed) return []

  const { lessonId, isPreset } = resolveLessonKey(lesson)
  if (!isPreset || !lessonId) {
    return VARIABLE_PRESETS
  }

  const allowedIds = VARIABLE_IDS_BY_LESSON_ID[lessonId]
  return allowedIds
    .map((id) => VARIABLE_PRESET_BY_ID.get(id))
    .filter((preset): preset is VariablePreset => Boolean(preset))
}

export function pruneVariableSelection(
  lesson: string,
  givenVariableIds: string[],
  findVariableIds: string[],
  targetRandomize: boolean
): { givenVariableIds: string[]; findVariableIds: string[] } {
  const lessonVarSet = new Set(getVariablesForLesson(lesson).map((preset) => preset.id))
  const scopedFind = findVariableIds.filter((id) => lessonVarSet.has(id))
  const scopedFindSet = new Set(scopedFind)
  const compatible = new Set(getCompatibleGivenIds(lesson, scopedFind, targetRandomize))

  return {
    findVariableIds: scopedFind,
    givenVariableIds: givenVariableIds.filter(
      (id) => compatible.has(id) && !scopedFindSet.has(id)
    ),
  }
}

export type VariableRow = {
  id: string
  symbol: string
  label: string
  unit: string
  value: string
}

export function toVariableRows(
  givenVariableIds: string[],
  findVariableIds: string[]
): { given: VariableRow[]; target: VariableRow[] } {
  const presets = getVariablePresets()
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

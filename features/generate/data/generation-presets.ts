export type ScenarioPreset = {
  id: string
  label: string
  description: string
}

export type VariablePreset = {
  id: string
  symbol: string
  label: string
  unit?: string
  defaultValue?: string | number
}

export const LESSON_SUGGESTIONS: string[] = [
  "Motion in one dimension",
  "Newton's laws",
  "Energy & work",
  "Circular motion",
  "Momentum & collisions",
  "Waves & oscillations",
  "Electrostatics",
  "Magnetic fields",
]

function lessonScenarios(
  lesson: string,
  items: { label: string; description: string }[]
): ScenarioPreset[] {
  const slug = lesson
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return items.map((item, index) => ({
    id: `physics-${slug}-${index + 1}`,
    label: item.label,
    description: item.description,
  }))
}

const SCENARIOS_BY_LESSON: Record<string, ScenarioPreset[]> = {
  "Motion in one dimension": lessonScenarios("Motion in one dimension", [
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
  ]),
  "Newton's laws": lessonScenarios("Newton's laws", [
    { label: "Find net force", description: "Find net force given mass and acceleration (F = ma)." },
    { label: "Find acceleration", description: "Find acceleration from applied forces and mass." },
    { label: "Friction on a surface", description: "Solve a problem involving kinetic or static friction." },
    { label: "Inclined plane", description: "Analyze forces on an object on an inclined plane." },
  ]),
  "Energy & work": lessonScenarios("Energy & work", [
    { label: "Kinetic energy", description: "Calculate kinetic energy from mass and speed." },
    { label: "Gravitational PE", description: "Calculate gravitational potential energy near Earth's surface." },
    { label: "Work done", description: "Calculate work done by a constant force over a displacement." },
    { label: "Conservation of energy", description: "Use conservation of mechanical energy to find an unknown." },
  ]),
  "Circular motion": lessonScenarios("Circular motion", [
    { label: "Centripetal acceleration", description: "Find centripetal acceleration from speed and radius." },
    { label: "Centripetal force", description: "Find centripetal force required for circular motion." },
    { label: "Period and frequency", description: "Relate period, frequency, and angular speed for uniform circular motion." },
    { label: "Banked curve", description: "Analyze forces on a vehicle moving around a banked curve." },
  ]),
  "Momentum & collisions": lessonScenarios("Momentum & collisions", [
    { label: "Momentum", description: "Calculate momentum from mass and velocity." },
    { label: "Elastic collision", description: "Solve a one-dimensional elastic collision problem." },
    { label: "Inelastic collision", description: "Solve a perfectly inelastic collision problem." },
    { label: "Impulse", description: "Relate impulse to change in momentum." },
  ]),
  "Waves & oscillations": lessonScenarios("Waves & oscillations", [
    { label: "Wave speed", description: "Find wave speed from frequency and wavelength." },
    { label: "Simple harmonic period", description: "Find the period of a mass-spring or simple pendulum system." },
    { label: "Standing waves", description: "Determine wavelength or frequency for a standing wave on a string." },
    { label: "Doppler effect", description: "Calculate observed frequency using the Doppler effect." },
  ]),
  Electrostatics: lessonScenarios("Electrostatics", [
    { label: "Coulomb force", description: "Calculate electrostatic force between two point charges." },
    { label: "Electric field", description: "Find electric field strength at a point due to charges." },
    { label: "Electric potential", description: "Calculate electric potential or potential difference." },
    { label: "Capacitor energy", description: "Find energy stored in a capacitor or charge on plates." },
  ]),
  "Magnetic fields": lessonScenarios("Magnetic fields", [
    { label: "Magnetic force on wire", description: "Find magnetic force on a current-carrying wire in a field." },
    { label: "Force on moving charge", description: "Calculate magnetic force on a moving charged particle." },
    { label: "Induced EMF", description: "Apply Faraday's law to find induced EMF." },
    { label: "Solenoid field", description: "Estimate magnetic field inside a solenoid." },
  ]),
}

export const FALLBACK_SCENARIOS: ScenarioPreset[] = lessonScenarios("general", [
  {
    label: "Find final velocity",
    description: "Find final velocity given initial velocity, acceleration, and time.",
  },
  { label: "Find force", description: "Find force using Newton's second law or related principles." },
  { label: "Energy calculation", description: "Calculate kinetic or potential energy in a physical system." },
  { label: "Unit conversion", description: "Convert physical quantities between SI units and solve." },
])

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

export function getScenariosForLesson(
  lesson: string
): { scenarios: ScenarioPreset[]; isFallback: boolean } {
  const trimmed = lesson.trim()
  const exact = SCENARIOS_BY_LESSON[trimmed]
  if (exact && exact.length > 0) {
    return { scenarios: exact, isFallback: false }
  }
  return { scenarios: FALLBACK_SCENARIOS, isFallback: true }
}

export function findScenarioById(
  lesson: string,
  scenarioId: string
): ScenarioPreset | undefined {
  const { scenarios } = getScenariosForLesson(lesson)
  return scenarios.find((s) => s.id === scenarioId)
}

export function getVariablePresets(): VariablePreset[] {
  return VARIABLE_PRESETS
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
  targetVariableId: string
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

  const targetPreset = targetVariableId ? byId.get(targetVariableId) : undefined
  const target = targetPreset
    ? [
        {
          id: targetPreset.id,
          symbol: targetPreset.symbol,
          label: targetPreset.label,
          unit: targetPreset.unit ?? "",
          value: "",
        },
      ]
    : []

  return { given, target }
}

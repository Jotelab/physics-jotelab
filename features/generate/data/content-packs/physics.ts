import {
  FALLBACK_LESSON_KEY,
  type SubjectContentPack,
} from "@/features/generate/data/content-pack"
import type { EngineTopic } from "@/lib/engine/topic-types"

export const PHYSICS_LESSON_IDS = [
  "motion-1d",
  "newtons-laws",
  "energy-work",
  "circular-motion",
  "momentum-collisions",
  "waves-oscillations",
  "electrostatics",
  "magnetic-fields",
] as const

export type PhysicsLessonId = (typeof PHYSICS_LESSON_IDS)[number]

const lessonLabelsEn: Record<PhysicsLessonId, string> = {
  "motion-1d": "Motion in one dimension",
  "newtons-laws": "Newton's laws",
  "energy-work": "Energy & work",
  "circular-motion": "Circular motion",
  "momentum-collisions": "Momentum & collisions",
  "waves-oscillations": "Waves & oscillations",
  electrostatics: "Electrostatics",
  "magnetic-fields": "Magnetic fields",
}

const scenarioContent: SubjectContentPack["scenarioContent"] = {
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
  [FALLBACK_LESSON_KEY]: [
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

const variableIdsByLesson: Record<PhysicsLessonId, string[]> = {
  "motion-1d": ["phys-v", "phys-v0", "phys-a", "phys-t", "phys-s"],
  "newtons-laws": ["phys-f", "phys-m", "phys-a"],
  "energy-work": ["phys-ek", "phys-ep", "phys-f", "phys-m", "phys-v", "phys-s"],
  "circular-motion": ["phys-v", "phys-a", "phys-r", "phys-f", "phys-m", "phys-t"],
  "momentum-collisions": ["phys-p", "phys-m", "phys-v", "phys-f", "phys-t"],
  "waves-oscillations": ["phys-v", "phys-t", "phys-s"],
  electrostatics: ["phys-q", "phys-f", "phys-r"],
  "magnetic-fields": ["phys-q", "phys-f", "phys-v", "phys-r"],
}

const givenCandidatesByLessonAndFind: Record<PhysicsLessonId, Record<string, string[]>> = {
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

/**
 * The symbolic engine names 1-D kinematics variables `u, v, a, t, s`; the
 * product surface uses different display symbols (`v₀` for initial velocity)
 * and Thai labels. This table is the translation between the two.
 *
 * It must agree with `variablePresets` below on symbol and unit for every
 * variable it names — `lib/engine/topics.test.ts` asserts exactly that, so the
 * two tables cannot drift apart.
 */
const SUVAT: EngineTopic = {
  topic: "suvat",
  variables: {
    u: { symbol: "v₀", label: "ความเร็วต้น", unit: "m/s" },
    v: { symbol: "v", label: "ความเร็วปลาย", unit: "m/s" },
    a: { symbol: "a", label: "ความเร่ง", unit: "m/s²" },
    t: { symbol: "t", label: "เวลา", unit: "s" },
    s: { symbol: "s", label: "การกระจัด", unit: "m" },
  },
}

/**
 * Which physics lessons are engine-backed. Adding a Phase 4 topic = adding its
 * lesson id here with its variable metadata; routing and assembly pick it up
 * automatically.
 */
const engineTopics: Partial<Record<PhysicsLessonId, EngineTopic>> = {
  "motion-1d": SUVAT,
}

export const physicsContentPack: SubjectContentPack = {
  lessonIds: PHYSICS_LESSON_IDS,
  lessonLabelsEn,
  scenarioContent,
  variablePresets: [
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
  ],
  variableIdsByLesson,
  givenCandidatesByLessonAndFind,
  engineTopics,
  prompt: {
    questionKind: "calculation question",
    generationRules: `- The question must be solvable from the given values.
- Double-check all arithmetic. Ensure the final_answer strictly mathematically follows the given numbers.
- Include solution steps and final answer.
- Use high-school appropriate numbers.
- Include units when relevant (Thai or standard SI abbreviations are fine).
- Strictly enforce LaTeX formatting. Use $ for inline math equations and $$ for block math equations.
- Do not require diagrams or images.
- Do not include markdown.`,
  },
}

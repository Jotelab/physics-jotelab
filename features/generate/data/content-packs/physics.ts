import {
  FALLBACK_LESSON_KEY,
  type SubjectContentPack,
} from "@/features/generate/data/content-pack"

export const PHYSICS_LESSON_IDS = [
  "motion-1d",
  "vectors-1d",
  "distance-displacement",
  "average-speed",
  "free-fall",
  "upward-throw",
  "multi-stage-motion",
  "motion-graphs",
  "relative-velocity",
  "pursuit",
  "two-phase-ascent",
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
  "vectors-1d": "Vectors in one dimension",
  "distance-displacement": "Distance & displacement",
  "average-speed": "Average speed & velocity",
  "free-fall": "Free fall",
  "upward-throw": "Upward throw",
  "multi-stage-motion": "Multi-stage motion",
  "motion-graphs": "Motion graphs",
  "relative-velocity": "Relative velocity",
  pursuit: "Pursuit & chase",
  "two-phase-ascent": "Two-phase ascent",
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
  "vectors-1d": [
    {
      label: "Find velocity",
      description: "Find the (signed) velocity given displacement and time for uniform 1-D motion.",
    },
    {
      label: "Find displacement",
      description: "Find the signed displacement given velocity and time.",
    },
    { label: "Find time", description: "Find the time given displacement and velocity." },
  ],
  "distance-displacement": [
    {
      label: "Find displacement",
      description:
        "Find the net (signed) displacement of a two-segment path along a line.",
    },
    {
      label: "Find distance",
      description: "Find the total path length of a two-segment trip along a line.",
    },
  ],
  "average-speed": [
    {
      label: "Find average speed",
      description:
        "Find the average speed of a two-segment trip given both segments and the total time.",
    },
    {
      label: "Find average velocity",
      description:
        "Find the (signed) average velocity of a two-segment trip given both segments and the total time.",
    },
  ],
  "free-fall": [
    {
      label: "Find final speed",
      description: "Find the speed of a falling object after a given time or distance.",
    },
    {
      label: "Find fall distance",
      description: "Find how far an object falls from its speeds or fall time.",
    },
    { label: "Find fall time", description: "Find how long an object takes to fall." },
    {
      label: "Find initial speed",
      description: "Find the initial downward speed of a thrown-down object.",
    },
  ],
  "upward-throw": [
    {
      label: "Find velocity",
      description:
        "Find the (signed) velocity of an object thrown straight up at a given time.",
    },
    {
      label: "Find height",
      description: "Find the height above the launch point at a given time.",
    },
    {
      label: "Find time",
      description: "Find the time for a thrown-up object to reach a given velocity.",
    },
    {
      label: "Find launch speed",
      description: "Find the initial upward speed from the motion at a later time.",
    },
  ],
  "multi-stage-motion": [
    {
      label: "Find total displacement",
      description:
        "An object accelerates, then moves at constant velocity; find the total displacement.",
    },
    {
      label: "Find cruise velocity",
      description:
        "Find the constant velocity of the second phase from the total displacement.",
    },
    {
      label: "Find initial velocity",
      description: "Find the starting velocity of the accelerating phase.",
    },
  ],
  "motion-graphs": [
    {
      label: "Find displacement from the graph",
      description:
        "Read a velocity–time graph of a two-phase motion and find the total displacement (area).",
    },
    {
      label: "Find acceleration from the graph",
      description: "Find the acceleration from the slope of the first phase.",
    },
    {
      label: "Find cruise velocity",
      description: "Find the constant velocity of the second phase from the graph.",
    },
    {
      label: "Find initial velocity",
      description: "Find the starting velocity from the graph.",
    },
  ],
  "relative-velocity": [
    {
      label: "Find relative velocity",
      description: "Find the velocity of one body relative to another moving along the same line.",
    },
    {
      label: "Find velocity of A",
      description: "Find a body's velocity from the other body's velocity and their relative velocity.",
    },
    {
      label: "Find velocity of B",
      description: "Find the second body's velocity from the first body's and the relative velocity.",
    },
  ],
  pursuit: [
    {
      label: "Find catch-up time",
      description:
        "A constant-speed pursuer starts behind an accelerating object; find when it catches up.",
    },
    {
      label: "Find pursuer speed",
      description: "Find the constant speed needed to catch up in a given time.",
    },
    {
      label: "Find acceleration",
      description: "Find the accelerating object's acceleration from the chase.",
    },
    {
      label: "Find initial gap",
      description: "Find the starting separation from the chase.",
    },
  ],
  "two-phase-ascent": [
    {
      label: "Find maximum height",
      description:
        "A rocket accelerates upward, then coasts under gravity; find the peak height.",
    },
    {
      label: "Find engine acceleration",
      description: "Find the powered-phase acceleration from the peak height.",
    },
    {
      label: "Find burn time",
      description: "Find the powered-phase duration from the peak height.",
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
  "vectors-1d": ["phys-vel", "phys-s", "phys-t"],
  "distance-displacement": ["phys-d1", "phys-d2", "phys-s", "phys-dist"],
  "average-speed": ["phys-d1", "phys-d2", "phys-t", "phys-sp", "phys-vavg"],
  "free-fall": ["phys-v0", "phys-v", "phys-t", "phys-h", "phys-g"],
  "upward-throw": ["phys-v0", "phys-v", "phys-g", "phys-t", "phys-h"],
  "multi-stage-motion": ["phys-v0", "phys-v", "phys-a", "phys-t1", "phys-t2", "phys-s"],
  "motion-graphs": ["phys-v0", "phys-v", "phys-a", "phys-t1", "phys-t2", "phys-s"],
  "relative-velocity": ["phys-va", "phys-vb", "phys-vab"],
  pursuit: ["phys-gap", "phys-a", "phys-vconst", "phys-t"],
  "two-phase-ascent": ["phys-a", "phys-t1", "phys-g", "phys-hmax"],
  "newtons-laws": ["phys-f", "phys-m", "phys-a"],
  "energy-work": ["phys-ek", "phys-ep", "phys-f", "phys-m", "phys-v", "phys-s"],
  "circular-motion": ["phys-v", "phys-a", "phys-r", "phys-f", "phys-m", "phys-t"],
  "momentum-collisions": ["phys-p", "phys-m", "phys-v", "phys-f", "phys-t"],
  "waves-oscillations": ["phys-v", "phys-t", "phys-s"],
  electrostatics: ["phys-q", "phys-f", "phys-r"],
  "magnetic-fields": ["phys-q", "phys-f", "phys-v", "phys-r"],
}

// These maps mirror the engine templates' solvability rules (jotelab-ai
// `templates/*.py` / `templates/data/*.json`): a find id appears as a key only
// if the engine can solve for it, and its candidate givens are the variables
// the engine accepts alongside it. Variables the engine never solves for
// (e.g. path segments d₁/d₂, or g) are given-only and have no key.
const givenCandidatesByLessonAndFind: Record<PhysicsLessonId, Record<string, string[]>> = {
  "motion-1d": {
    "phys-v": ["phys-v0", "phys-a", "phys-t", "phys-s"],
    "phys-v0": ["phys-v", "phys-a", "phys-t", "phys-s"],
    "phys-a": ["phys-v", "phys-v0", "phys-t", "phys-s"],
    "phys-t": ["phys-v", "phys-v0", "phys-a", "phys-s"],
    "phys-s": ["phys-v", "phys-v0", "phys-a", "phys-t"],
  },
  "vectors-1d": {
    "phys-vel": ["phys-s", "phys-t"],
    "phys-s": ["phys-vel", "phys-t"],
    "phys-t": ["phys-vel", "phys-s"],
  },
  "distance-displacement": {
    "phys-s": ["phys-d1", "phys-d2"],
    "phys-dist": ["phys-d1", "phys-d2"],
  },
  "average-speed": {
    "phys-sp": ["phys-d1", "phys-d2", "phys-t"],
    "phys-vavg": ["phys-d1", "phys-d2", "phys-t"],
  },
  "free-fall": {
    "phys-v": ["phys-v0", "phys-t", "phys-h", "phys-g"],
    "phys-v0": ["phys-v", "phys-t", "phys-h", "phys-g"],
    "phys-t": ["phys-v0", "phys-v", "phys-h", "phys-g"],
    "phys-h": ["phys-v0", "phys-v", "phys-t", "phys-g"],
  },
  "upward-throw": {
    "phys-v": ["phys-v0", "phys-g", "phys-t"],
    "phys-h": ["phys-v0", "phys-v", "phys-g", "phys-t"],
    "phys-t": ["phys-v0", "phys-v", "phys-g"],
    "phys-v0": ["phys-v", "phys-g", "phys-t"],
  },
  "multi-stage-motion": {
    "phys-s": ["phys-v0", "phys-v", "phys-a", "phys-t1", "phys-t2"],
    "phys-v": ["phys-s", "phys-v0", "phys-t1", "phys-t2"],
    "phys-v0": ["phys-s", "phys-v", "phys-t1", "phys-t2"],
  },
  "motion-graphs": {
    "phys-s": ["phys-v0", "phys-v", "phys-a", "phys-t1", "phys-t2"],
    "phys-v": ["phys-s", "phys-v0", "phys-t1", "phys-t2"],
    "phys-v0": ["phys-s", "phys-v", "phys-t1", "phys-t2"],
    "phys-a": ["phys-s", "phys-v0", "phys-t1", "phys-t2"],
  },
  "relative-velocity": {
    "phys-vab": ["phys-va", "phys-vb"],
    "phys-va": ["phys-vab", "phys-vb"],
    "phys-vb": ["phys-va", "phys-vab"],
  },
  pursuit: {
    "phys-t": ["phys-gap", "phys-a", "phys-vconst"],
    "phys-vconst": ["phys-gap", "phys-a", "phys-t"],
    "phys-a": ["phys-gap", "phys-vconst", "phys-t"],
    "phys-gap": ["phys-a", "phys-vconst", "phys-t"],
  },
  "two-phase-ascent": {
    "phys-hmax": ["phys-a", "phys-g", "phys-t1"],
    "phys-a": ["phys-hmax", "phys-g", "phys-t1"],
    "phys-t1": ["phys-hmax", "phys-a", "phys-g"],
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
    { id: "phys-vel", symbol: "v", label: "velocity", unit: "m/s" },
    { id: "phys-d1", symbol: "d₁", label: "first segment displacement", unit: "m" },
    { id: "phys-d2", symbol: "d₂", label: "second segment displacement", unit: "m" },
    { id: "phys-dist", symbol: "d", label: "distance", unit: "m" },
    { id: "phys-sp", symbol: "v̄", label: "average speed", unit: "m/s" },
    { id: "phys-vavg", symbol: "v̄ₛ", label: "average velocity", unit: "m/s" },
    { id: "phys-g", symbol: "g", label: "gravitational acceleration", unit: "m/s²", defaultValue: 10 },
    { id: "phys-h", symbol: "h", label: "height", unit: "m" },
    { id: "phys-t1", symbol: "t₁", label: "phase 1 time", unit: "s" },
    { id: "phys-t2", symbol: "t₂", label: "phase 2 time", unit: "s" },
    { id: "phys-gap", symbol: "d₀", label: "initial gap", unit: "m" },
    { id: "phys-vconst", symbol: "v", label: "constant speed", unit: "m/s" },
    { id: "phys-va", symbol: "vᴬ", label: "velocity of A", unit: "m/s" },
    { id: "phys-vb", symbol: "vᴮ", label: "velocity of B", unit: "m/s" },
    { id: "phys-vab", symbol: "vᴬᴮ", label: "velocity of A relative to B", unit: "m/s" },
    { id: "phys-hmax", symbol: "H", label: "maximum height", unit: "m" },
  ],
  variableIdsByLesson,
  givenCandidatesByLessonAndFind,
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

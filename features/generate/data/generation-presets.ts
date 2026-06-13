import type { Subject } from "@/features/generate/types"

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

export const LESSON_SUGGESTIONS: Record<Subject, string[]> = {
  math: [
    "Linear equations",
    "Quadratic functions",
    "Trigonometry",
    "Calculus – derivatives",
    "Calculus – integrals",
    "Probability & statistics",
    "Vectors & matrices",
    "Logarithms & exponents",
  ],
  physics: [
    "Motion in one dimension",
    "Newton's laws",
    "Energy & work",
    "Circular motion",
    "Momentum & collisions",
    "Waves & oscillations",
    "Electrostatics",
    "Magnetic fields",
  ],
  chemistry: [
    "Stoichiometry",
    "Acid-base reactions",
    "Gas laws",
    "Electrochemistry",
    "Chemical equilibrium",
    "Thermochemistry",
    "Oxidation & reduction",
    "Solution concentration",
  ],
}

function lessonScenarios(
  subject: Subject,
  lesson: string,
  items: { label: string; description: string }[]
): ScenarioPreset[] {
  const slug = lesson
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return items.map((item, index) => ({
    id: `${subject}-${slug}-${index + 1}`,
    label: item.label,
    description: item.description,
  }))
}

const MATH_SCENARIOS: Record<string, ScenarioPreset[]> = {
  "Linear equations": lessonScenarios("math", "Linear equations", [
    { label: "Solve for x", description: "Solve a linear equation for the unknown variable x." },
    { label: "Find the slope", description: "Find the slope of a line from two points or an equation." },
    { label: "Write line equation", description: "Write the equation of a line given slope and a point." },
    { label: "Systems of two equations", description: "Solve a system of two linear equations in two variables." },
  ]),
  "Quadratic functions": lessonScenarios("math", "Quadratic functions", [
    { label: "Find the roots", description: "Find the roots of a quadratic equation by factoring or formula." },
    { label: "Find the vertex", description: "Find the vertex of a parabola from standard or vertex form." },
    { label: "Complete the square", description: "Rewrite a quadratic in vertex form by completing the square." },
    { label: "Maximum or minimum", description: "Determine the maximum or minimum value of a quadratic function." },
  ]),
  Trigonometry: lessonScenarios("math", "Trigonometry", [
    { label: "Find a side", description: "Use trigonometric ratios to find an unknown side in a right triangle." },
    { label: "Find an angle", description: "Use inverse trig functions to find an unknown angle." },
    { label: "Unit circle values", description: "Evaluate sine, cosine, or tangent at a standard angle." },
    { label: "Identity simplification", description: "Simplify an expression using basic trigonometric identities." },
  ]),
  "Calculus – derivatives": lessonScenarios("math", "Calculus – derivatives", [
    { label: "Power rule", description: "Differentiate a polynomial using the power rule." },
    { label: "Tangent line", description: "Find the equation of the tangent line at a given point." },
    { label: "Product or quotient rule", description: "Differentiate a product or quotient of functions." },
    { label: "Rate of change", description: "Interpret the derivative as an instantaneous rate of change." },
  ]),
  "Calculus – integrals": lessonScenarios("math", "Calculus – integrals", [
    { label: "Definite integral", description: "Evaluate a definite integral of a basic polynomial." },
    { label: "Area under curve", description: "Find the area under a curve between two bounds." },
    { label: "Antiderivative", description: "Find the antiderivative of a simple function." },
    { label: "Displacement from velocity", description: "Find displacement given velocity as a function of time." },
  ]),
  "Probability & statistics": lessonScenarios("math", "Probability & statistics", [
    { label: "Basic probability", description: "Calculate probability of a single event or complement." },
    { label: "Compound events", description: "Find probability of independent or mutually exclusive events." },
    { label: "Mean and median", description: "Compute mean or median from a small data set." },
    { label: "Standard deviation", description: "Calculate standard deviation for a given data set." },
  ]),
  "Vectors & matrices": lessonScenarios("math", "Vectors & matrices", [
    { label: "Vector magnitude", description: "Find the magnitude of a 2D or 3D vector." },
    { label: "Dot product", description: "Compute the dot product of two vectors." },
    { label: "Matrix multiplication", description: "Multiply two small matrices." },
    { label: "Angle between vectors", description: "Find the angle between two vectors using the dot product." },
  ]),
  "Logarithms & exponents": lessonScenarios("math", "Logarithms & exponents", [
    { label: "Solve exponential equation", description: "Solve an equation involving exponentials using logarithms." },
    { label: "Evaluate logarithm", description: "Evaluate or simplify a logarithmic expression." },
    { label: "Change of base", description: "Rewrite a logarithm using the change-of-base formula." },
    { label: "Growth or decay", description: "Model exponential growth or decay and solve for an unknown." },
  ]),
}

const PHYSICS_SCENARIOS: Record<string, ScenarioPreset[]> = {
  "Motion in one dimension": lessonScenarios("physics", "Motion in one dimension", [
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
  "Newton's laws": lessonScenarios("physics", "Newton's laws", [
    { label: "Find net force", description: "Find net force given mass and acceleration (F = ma)." },
    { label: "Find acceleration", description: "Find acceleration from applied forces and mass." },
    { label: "Friction on a surface", description: "Solve a problem involving kinetic or static friction." },
    { label: "Inclined plane", description: "Analyze forces on an object on an inclined plane." },
  ]),
  "Energy & work": lessonScenarios("physics", "Energy & work", [
    { label: "Kinetic energy", description: "Calculate kinetic energy from mass and speed." },
    { label: "Gravitational PE", description: "Calculate gravitational potential energy near Earth's surface." },
    { label: "Work done", description: "Calculate work done by a constant force over a displacement." },
    { label: "Conservation of energy", description: "Use conservation of mechanical energy to find an unknown." },
  ]),
  "Circular motion": lessonScenarios("physics", "Circular motion", [
    { label: "Centripetal acceleration", description: "Find centripetal acceleration from speed and radius." },
    { label: "Centripetal force", description: "Find centripetal force required for circular motion." },
    { label: "Period and frequency", description: "Relate period, frequency, and angular speed for uniform circular motion." },
    { label: "Banked curve", description: "Analyze forces on a vehicle moving around a banked curve." },
  ]),
  "Momentum & collisions": lessonScenarios("physics", "Momentum & collisions", [
    { label: "Momentum", description: "Calculate momentum from mass and velocity." },
    { label: "Elastic collision", description: "Solve a one-dimensional elastic collision problem." },
    { label: "Inelastic collision", description: "Solve a perfectly inelastic collision problem." },
    { label: "Impulse", description: "Relate impulse to change in momentum." },
  ]),
  "Waves & oscillations": lessonScenarios("physics", "Waves & oscillations", [
    { label: "Wave speed", description: "Find wave speed from frequency and wavelength." },
    { label: "Simple harmonic period", description: "Find the period of a mass-spring or simple pendulum system." },
    { label: "Standing waves", description: "Determine wavelength or frequency for a standing wave on a string." },
    { label: "Doppler effect", description: "Calculate observed frequency using the Doppler effect." },
  ]),
  Electrostatics: lessonScenarios("physics", "Electrostatics", [
    { label: "Coulomb force", description: "Calculate electrostatic force between two point charges." },
    { label: "Electric field", description: "Find electric field strength at a point due to charges." },
    { label: "Electric potential", description: "Calculate electric potential or potential difference." },
    { label: "Capacitor energy", description: "Find energy stored in a capacitor or charge on plates." },
  ]),
  "Magnetic fields": lessonScenarios("physics", "Magnetic fields", [
    { label: "Magnetic force on wire", description: "Find magnetic force on a current-carrying wire in a field." },
    { label: "Force on moving charge", description: "Calculate magnetic force on a moving charged particle." },
    { label: "Induced EMF", description: "Apply Faraday's law to find induced EMF." },
    { label: "Solenoid field", description: "Estimate magnetic field inside a solenoid." },
  ]),
}

const CHEMISTRY_SCENARIOS: Record<string, ScenarioPreset[]> = {
  Stoichiometry: lessonScenarios("chemistry", "Stoichiometry", [
    { label: "Moles from mass", description: "Convert between mass and amount of substance using molar mass." },
    { label: "Limiting reactant", description: "Identify the limiting reactant and predict product yield." },
    { label: "Mass of product", description: "Calculate mass of product from given reactant amounts." },
    { label: "Percent yield", description: "Calculate percent yield from actual and theoretical yield." },
  ]),
  "Acid-base reactions": lessonScenarios("chemistry", "Acid-base reactions", [
    { label: "pH from concentration", description: "Calculate pH from hydrogen ion concentration." },
    { label: "Neutralization", description: "Balance and solve a neutralization reaction problem." },
    { label: "Conjugate pairs", description: "Identify acid-base conjugate pairs in a reaction." },
    { label: "Titration volume", description: "Find volume or concentration needed to reach equivalence." },
  ]),
  "Gas laws": lessonScenarios("chemistry", "Gas laws", [
    { label: "Ideal gas law", description: "Use PV = nRT to solve for an unknown gas variable." },
    { label: "Combined gas law", description: "Apply the combined gas law when amount is constant." },
    { label: "STP volume", description: "Find molar volume or gas volume at STP." },
    { label: "Partial pressure", description: "Calculate partial pressure in a gas mixture." },
  ]),
  Electrochemistry: lessonScenarios("chemistry", "Electrochemistry", [
    { label: "Cell potential", description: "Calculate standard cell potential from half-reactions." },
    { label: "Electrolysis charge", description: "Relate charge passed to amount of substance produced." },
    { label: "Oxidation numbers", description: "Assign oxidation numbers and identify redox changes." },
    { label: "Faraday's law", description: "Use Faraday's law in an electrolysis calculation." },
  ]),
  "Chemical equilibrium": lessonScenarios("chemistry", "Chemical equilibrium", [
    { label: "Kc expression", description: "Write the equilibrium constant expression for a reaction." },
    { label: "ICE table", description: "Solve an equilibrium problem using an ICE table." },
    { label: "Reaction quotient", description: "Compare Q to K to predict shift direction." },
    { label: "Le Chatelier", description: "Predict how a stress shifts equilibrium position." },
  ]),
  Thermochemistry: lessonScenarios("chemistry", "Thermochemistry", [
    { label: "Enthalpy change", description: "Calculate enthalpy change from bond energies or Hess's law." },
    { label: "Specific heat", description: "Use q = mcΔT to find heat absorbed or released." },
    { label: "Calorimetry", description: "Solve a calorimetry problem to find unknown heat capacity." },
    { label: "Standard enthalpy", description: "Calculate ΔH° from standard enthalpies of formation." },
  ]),
  "Oxidation & reduction": lessonScenarios("chemistry", "Oxidation & reduction", [
    { label: "Balance redox", description: "Balance a redox equation in acidic or basic solution." },
    { label: "Oxidizing agent", description: "Identify oxidizing and reducing agents in a reaction." },
    { label: "Electron transfer", description: "Determine electrons transferred per atom in a redox process." },
    { label: "Corrosion", description: "Analyze a simple corrosion or galvanic cell scenario." },
  ]),
  "Solution concentration": lessonScenarios("chemistry", "Solution concentration", [
    { label: "Molarity", description: "Calculate molarity or moles of solute in a solution." },
    { label: "Dilution", description: "Use M₁V₁ = M₂V₂ for a dilution problem." },
    { label: "Mass percent", description: "Calculate mass percent concentration of a solution." },
    { label: "Prepare a solution", description: "Determine mass or volume needed to prepare a target solution." },
  ]),
}

const SCENARIOS_BY_SUBJECT: Record<Subject, Record<string, ScenarioPreset[]>> = {
  math: MATH_SCENARIOS,
  physics: PHYSICS_SCENARIOS,
  chemistry: CHEMISTRY_SCENARIOS,
}

export const SUBJECT_FALLBACK_SCENARIOS: Record<Subject, ScenarioPreset[]> = {
  math: lessonScenarios("math", "general", [
    { label: "Solve for unknown", description: "Solve for an unknown in a standard math problem." },
    { label: "Evaluate expression", description: "Evaluate a numerical or algebraic expression." },
    { label: "Word problem", description: "Set up and solve a word problem from a real-world context." },
    { label: "Graph interpretation", description: "Interpret or use information from a graph." },
  ]),
  physics: lessonScenarios("physics", "general", [
    {
      label: "Find final velocity",
      description: "Find final velocity given initial velocity, acceleration, and time.",
    },
    { label: "Find force", description: "Find force using Newton's second law or related principles." },
    { label: "Energy calculation", description: "Calculate kinetic or potential energy in a physical system." },
    { label: "Unit conversion", description: "Convert physical quantities between SI units and solve." },
  ]),
  chemistry: lessonScenarios("chemistry", "general", [
    { label: "Stoichiometry", description: "Perform a stoichiometry calculation with balanced equations." },
    { label: "Concentration", description: "Calculate solution concentration or amount of solute." },
    { label: "Gas law", description: "Apply an ideal or combined gas law to find an unknown." },
    { label: "Equilibrium", description: "Solve a basic chemical equilibrium problem." },
  ]),
}

export const VARIABLE_PRESETS: Record<Subject, VariablePreset[]> = {
  math: [
    { id: "math-x", symbol: "x", label: "unknown variable" },
    { id: "math-y", symbol: "y", label: "dependent variable" },
    { id: "math-m", symbol: "m", label: "slope" },
    { id: "math-b", symbol: "b", label: "y-intercept" },
    { id: "math-a", symbol: "a", label: "coefficient" },
    { id: "math-c", symbol: "c", label: "constant term" },
    { id: "math-fx", symbol: "f(x)", label: "function value" },
    { id: "math-theta", symbol: "θ", label: "angle", unit: "°" },
    { id: "math-r", symbol: "r", label: "radius or rate" },
    { id: "math-n", symbol: "n", label: "sample size or exponent" },
  ],
  physics: [
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
  chemistry: [
    { id: "chem-n", symbol: "n", label: "amount of substance", unit: "mol" },
    { id: "chem-m", symbol: "m", label: "mass", unit: "g" },
    { id: "chem-molar", symbol: "M", label: "molar mass", unit: "g/mol" },
    { id: "chem-c", symbol: "c", label: "concentration", unit: "mol/L" },
    { id: "chem-v", symbol: "V", label: "volume", unit: "L" },
    { id: "chem-p", symbol: "P", label: "pressure", unit: "atm" },
    { id: "chem-t", symbol: "T", label: "temperature", unit: "K" },
    { id: "chem-ph", symbol: "pH", label: "acidity" },
    { id: "chem-kc", symbol: "Kc", label: "equilibrium constant" },
    { id: "chem-q", symbol: "q", label: "heat", unit: "J" },
    { id: "chem-delta-h", symbol: "ΔH", label: "enthalpy change", unit: "kJ/mol" },
  ],
}

export function getScenariosForLesson(
  subject: Subject,
  lesson: string
): { scenarios: ScenarioPreset[]; isFallback: boolean } {
  const trimmed = lesson.trim()
  const lessonScenariosMap = SCENARIOS_BY_SUBJECT[subject]
  const exact = lessonScenariosMap[trimmed]
  if (exact && exact.length > 0) {
    return { scenarios: exact, isFallback: false }
  }
  return { scenarios: SUBJECT_FALLBACK_SCENARIOS[subject], isFallback: true }
}

export function findScenarioById(
  subject: Subject,
  lesson: string,
  scenarioId: string
): ScenarioPreset | undefined {
  const { scenarios } = getScenariosForLesson(subject, lesson)
  return scenarios.find((s) => s.id === scenarioId)
}

export function getVariablePresets(subject: Subject): VariablePreset[] {
  return VARIABLE_PRESETS[subject]
}

export type VariableRow = {
  id: string
  symbol: string
  label: string
  unit: string
  value: string
}

export function toVariableRows(
  subject: Subject,
  givenVariableIds: string[],
  targetVariableId: string
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

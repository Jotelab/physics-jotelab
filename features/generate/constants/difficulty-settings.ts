import type { ConceptualDifficulty, MathComplexity } from "@/features/generate/types"

export const DEFAULT_MATH_COMPLEXITY: MathComplexity = "integers"
export const DEFAULT_CONCEPTUAL_DIFFICULTY: ConceptualDifficulty = "level_1"
export const DEFAULT_STAR_DIFFICULTY = 1

export const MATH_COMPLEXITY_OPTIONS: { value: MathComplexity; labelKey: string }[] = [
  { value: "integers", labelKey: "mathComplexity.integers" },
  { value: "decimals", labelKey: "mathComplexity.decimals" },
  { value: "scientific", labelKey: "mathComplexity.scientific" },
]

export const CONCEPTUAL_DIFFICULTY_OPTIONS: {
  value: ConceptualDifficulty
  labelKey: string
}[] = [
  { value: "level_1", labelKey: "conceptualDifficulty.level_1" },
  { value: "level_2", labelKey: "conceptualDifficulty.level_2" },
  { value: "level_3", labelKey: "conceptualDifficulty.level_3" },
]

export const CONCEPTUAL_DIFFICULTY_PROMPTS: Record<ConceptualDifficulty, string> = {
  level_1:
    "All given values use standard SI units. The student plugs values directly into the formula — no unit conversion required.",
  level_2:
    "Provide at least one given value in a non-standard unit (e.g. km/h, cm, g) that the student must convert to SI before solving. State the unit explicitly in the question.",
  level_3:
    "Include 1–2 irrelevant numerical values in question_text that are NOT needed for the solution (distractor data). The question must still be solvable using only the relevant given values.",
}

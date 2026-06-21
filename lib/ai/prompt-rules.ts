/** Shared prompt rules for worksheet question generation. */
export const THAI_LANGUAGE_RULES = `- Write all learner-facing text in Thai (ภาษาไทย): question_text, given_values labels, target_variable label, solution steps, and final_answer.
- Keep mathematical symbols, numbers, and equations in standard notation; wrap math in LaTeX using $ for inline and $$ for block.
- Use natural phrasing for Thai high-school students (ระดับมัธยมปลาย).`

export const CORE_QUESTION_RULES = `- The question must be solvable from the given values.
- Double-check all arithmetic. Ensure the final_answer strictly mathematically follows the given numbers.
- Include solution steps and final answer.
- Use high-school appropriate numbers.
- Include units when relevant (Thai or standard SI abbreviations are fine).
- Strictly enforce LaTeX formatting. Use $ for inline math equations and $$ for block math equations.
- Do not require diagrams or images.
- Do not include markdown.`

export const QUESTION_GENERATION_RULES = `Rules:
${CORE_QUESTION_RULES}
${THAI_LANGUAGE_RULES}`

const MATH_COMPLEXITY_PROMPTS = {
  integers:
    "Use clean integer values only for all numeric given_values. Avoid decimals and scientific notation.",
  decimals:
    "Use decimal values with 1–2 decimal places for all numeric given_values. Avoid integers-only and scientific notation.",
  scientific:
    "Express large or small magnitudes using scientific notation (e.g. 3.2 × 10⁵ or 3.2e5) in given_values and question_text when appropriate.",
} as const

export function buildMathComplexityRules(
  complexity: keyof typeof MATH_COMPLEXITY_PROMPTS = "integers"
) {
  return `- ${MATH_COMPLEXITY_PROMPTS[complexity]}`
}

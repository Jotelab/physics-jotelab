import { generateObject } from "ai"

import { generatedQuestionSchema } from "@/features/generate/schemas"
import type { GeneratedQuestion, Subject } from "@/features/generate/types"

import { getGenerationModel } from "./client"
import { getRegenerateErrorMessage, logGenerationError } from "./generation-errors"
import { normalizeGeneratedQuestion } from "./normalize-question"
import { CORE_QUESTION_RULES, THAI_LANGUAGE_RULES, buildMathComplexityRules } from "./prompt-rules"
import type { MathComplexity } from "@/features/generate/types"
import { DEFAULT_MATH_COMPLEXITY } from "@/features/generate/constants/difficulty-settings"

type RegenerateQuestionInput = {
  subject: Subject
  lesson: string
  scenario: string
  existingQuestionText: string
  mathComplexity?: MathComplexity
}

export async function regenerateWorksheetQuestion({
  subject,
  lesson,
  scenario,
  existingQuestionText,
  mathComplexity = DEFAULT_MATH_COMPLEXITY,
}: RegenerateQuestionInput): Promise<GeneratedQuestion> {
  try {
    const { object } = await generateObject({
      model: getGenerationModel(),
      schema: generatedQuestionSchema,
      prompt: `You are regenerating one high-school calculation question for Thai students.

Return only one structured JSON object that matches the provided schema.

Subject: ${subject}

Existing question to replace:
${existingQuestionText}

Generation intent:
Lesson: ${lesson}
Scenario: ${scenario}

Rules:
- Keep the same learning intent as the existing question.
- Use different numbers or a distinctly different setup.
${buildMathComplexityRules(mathComplexity)}
${CORE_QUESTION_RULES}
${THAI_LANGUAGE_RULES}`,
    })

    return generatedQuestionSchema.parse(
      normalizeGeneratedQuestion(object, { mathComplexity })
    )
  } catch (error) {
    logGenerationError("regenerateWorksheetQuestion", error)
    throw new Error(getRegenerateErrorMessage(error))
  }
}

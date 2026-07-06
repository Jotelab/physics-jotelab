import { generateObject } from "ai"

import { generatedQuestionSchema, modelCalculationOutputSchema } from "@/features/generate/schemas"
import type { GeneratedQuestion, Subject } from "@/features/generate/types"

import { getGenerationModel } from "./client"
import { getRegenerateErrorMessage, logGenerationError } from "./generation-errors"
import { normalizeGeneratedQuestion } from "./normalize-question"
import {
  UNTRUSTED_INPUT_NOTICE,
  buildMathComplexityRules,
  buildSubjectGenerationRules,
  fenceUntrusted,
  subjectQuestionKind,
} from "./prompt-rules"
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
      schema: modelCalculationOutputSchema,
      prompt: `You are regenerating one high-school ${subjectQuestionKind(subject)} for Thai students.

Return only one structured JSON object that matches the provided schema.

Subject: ${subject}

${UNTRUSTED_INPUT_NOTICE}

Existing question to replace:
${fenceUntrusted("existing_question", existingQuestionText)}

Generation intent:
${fenceUntrusted("lesson", lesson)}
${fenceUntrusted("scenario", scenario)}

Rules:
- Keep the same learning intent as the existing question.
- Use different numbers or a distinctly different setup.
${buildMathComplexityRules(mathComplexity)}
${buildSubjectGenerationRules(subject)}`,
    })

    return generatedQuestionSchema.parse(
      normalizeGeneratedQuestion(object, { mathComplexity })
    )
  } catch (error) {
    logGenerationError("regenerateWorksheetQuestion", error)
    throw new Error(getRegenerateErrorMessage(error))
  }
}

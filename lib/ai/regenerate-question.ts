import { generateObject } from "ai"

import { generatedQuestionSchema } from "@/features/generate/schemas"
import type { GeneratedQuestion, Subject } from "@/features/generate/types"

import { getGenerationModel } from "./client"
import { getRegenerateErrorMessage, logGenerationError } from "./generation-errors"
import { normalizeGeneratedQuestion } from "./normalize-question"
import { CORE_QUESTION_RULES, THAI_LANGUAGE_RULES } from "./prompt-rules"

type RegenerateQuestionInput = {
  subject: Subject
  lesson: string
  scenario: string
  existingQuestionText: string
}

export async function regenerateWorksheetQuestion({
  subject,
  lesson,
  scenario,
  existingQuestionText,
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
${CORE_QUESTION_RULES}
${THAI_LANGUAGE_RULES}`,
    })

    return generatedQuestionSchema.parse(normalizeGeneratedQuestion(object))
  } catch (error) {
    logGenerationError("regenerateWorksheetQuestion", error)
    throw new Error(getRegenerateErrorMessage(error))
  }
}

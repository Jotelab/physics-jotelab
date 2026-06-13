import { generateObject } from "ai"

import { generatedQuestionSchema } from "@/features/generate/schemas"
import type { GeneratedQuestion, Subject } from "@/features/generate/types"

import { getGenerationModel } from "./client"
import { e2eStubGeneratedQuestion } from "./e2e-stub-question"
import { getGenerationErrorMessage, logGenerationError } from "./generation-errors"
import { normalizeGeneratedQuestion } from "./normalize-question"
import { QUESTION_GENERATION_RULES } from "./prompt-rules"

type GenerateQuestionInput = {
  subject: Subject
  lesson: string
  scenario: string
  previousQuestionsContext: string[]
}

function formatPreviousQuestions(previousQuestionsContext: string[]) {
  if (previousQuestionsContext.length === 0) {
    return "None yet."
  }

  return previousQuestionsContext.map((question, index) => `${index + 1}. ${question}`).join("\n")
}

function buildGenerationPrompt({
  subject,
  lesson,
  scenario,
  previousQuestionsContext,
}: GenerateQuestionInput) {
  return `You are generating a high-school calculation question for Thai students.

Return only one structured JSON object that matches the provided schema.

Subject: ${subject}
Lesson: ${lesson}
Scenario: ${scenario}

Previously generated questions (DO NOT REPEAT THESE):
${formatPreviousQuestions(previousQuestionsContext)}

${QUESTION_GENERATION_RULES}`
}

export async function generateWorksheetQuestion(
  input: GenerateQuestionInput
): Promise<GeneratedQuestion> {
  if (process.env.E2E_STUB_GENERATION === "true") {
    return e2eStubGeneratedQuestion
  }

  try {
    const { object } = await generateObject({
      model: getGenerationModel(),
      schema: generatedQuestionSchema,
      prompt: buildGenerationPrompt(input),
    })

    return generatedQuestionSchema.parse(normalizeGeneratedQuestion(object))
  } catch (error) {
    logGenerationError("generateWorksheetQuestion", error)
    throw new Error(getGenerationErrorMessage(error))
  }
}

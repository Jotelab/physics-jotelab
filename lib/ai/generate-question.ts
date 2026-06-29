import { generateObject } from "ai"

import { calculationQuestionSchema, generatedQuestionSchema } from "@/features/generate/schemas"
import { DEFAULT_MATH_COMPLEXITY } from "@/features/generate/constants/difficulty-settings"
import type { GeneratedQuestion, MathComplexity, Subject } from "@/features/generate/types"

import { getGenerationModel } from "./client"
import { e2eStubGeneratedQuestion } from "./e2e-stub-question"
import { getGenerationErrorMessage, logGenerationError } from "./generation-errors"
import { normalizeGeneratedQuestion } from "./normalize-question"
import {
  QUESTION_GENERATION_RULES,
  UNTRUSTED_INPUT_NOTICE,
  buildMathComplexityRules,
  fenceUntrusted,
} from "./prompt-rules"

type GenerateQuestionInput = {
  subject: Subject
  lesson: string
  scenario: string
  previousQuestionsContext: string[]
  mathComplexity?: MathComplexity
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
  mathComplexity = DEFAULT_MATH_COMPLEXITY,
}: GenerateQuestionInput) {
  return `You are generating a high-school calculation question for Thai students.

Return only one structured JSON object that matches the provided schema.

Subject: ${subject}

${UNTRUSTED_INPUT_NOTICE}
${fenceUntrusted("lesson", lesson)}
${fenceUntrusted("scenario", scenario)}

Previously generated questions (DO NOT REPEAT THESE):
${fenceUntrusted("previous_questions", formatPreviousQuestions(previousQuestionsContext))}

${QUESTION_GENERATION_RULES}
${buildMathComplexityRules(mathComplexity)}`
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
      // Generation produces the calculation format today; pass that format's
      // concrete schema rather than the whole union so structured output stays
      // a single object shape.
      schema: calculationQuestionSchema,
      prompt: buildGenerationPrompt(input),
    })

    return generatedQuestionSchema.parse(
      normalizeGeneratedQuestion(object, {
        mathComplexity: input.mathComplexity ?? DEFAULT_MATH_COMPLEXITY,
      })
    )
  } catch (error) {
    logGenerationError("generateWorksheetQuestion", error)
    throw new Error(getGenerationErrorMessage(error))
  }
}

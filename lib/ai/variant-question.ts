import { generateObject } from "ai"

import { generatedQuestionSchema, modelCalculationOutputSchema } from "@/features/generate/schemas"
import type { GeneratedQuestion, Subject, VariantLabel, WorksheetQuestion } from "@/features/generate/types"

import { getGenerationModel } from "./client"
import { e2eStubVariantQuestion } from "./e2e-stub-question"
import { getGenerationErrorMessage, logGenerationError } from "./generation-errors"
import { normalizeGeneratedQuestion } from "./normalize-question"
import { buildSubjectGenerationRules, buildMathComplexityRules, subjectQuestionKind } from "./prompt-rules"
import type { MathComplexity } from "@/features/generate/types"
import { DEFAULT_MATH_COMPLEXITY } from "@/features/generate/constants/difficulty-settings"

type VariantQuestionInput = {
  subject: Subject
  masterQuestion: WorksheetQuestion
  variantLabel: VariantLabel
  mathComplexity?: MathComplexity
}

function formatMasterQuestion(masterQuestion: WorksheetQuestion) {
  return JSON.stringify(
    {
      question_text: masterQuestion.question_text,
      given_values: masterQuestion.given_values,
      target_variable: masterQuestion.target_variable,
      solution: masterQuestion.solution,
    },
    null,
    2
  )
}

export async function variantWorksheetQuestion({
  subject,
  masterQuestion,
  variantLabel,
  mathComplexity = DEFAULT_MATH_COMPLEXITY,
}: VariantQuestionInput): Promise<GeneratedQuestion> {
  if (process.env.E2E_STUB_GENERATION === "true") {
    return e2eStubVariantQuestion(masterQuestion, variantLabel)
  }

  try {
    const { object } = await generateObject({
      model: getGenerationModel(),
      schema: modelCalculationOutputSchema,
      prompt: `You are creating an alternate version (Version ${variantLabel}) of a high-school ${subjectQuestionKind(subject)} for Thai students.

Return only one structured JSON object that matches the provided schema.

Master question (Version A):
${formatMasterQuestion(masterQuestion)}

Rules:
- Keep the same learning intent and scenario structure as the master question.
- Keep question_text as identical as possible to the master (same wording, same LaTeX structure).
- Keep target_variable exactly the same (symbol, label, and unit).
- Change ALL numeric given_values to new, physically plausible values different from the master.
- Recalculate solution steps and final_answer to match the new given_values.
- Do NOT change which variable is being solved for.
${buildMathComplexityRules(mathComplexity)}
${buildSubjectGenerationRules(subject)}`,
    })

    const normalized = generatedQuestionSchema.parse(
      normalizeGeneratedQuestion(object, { mathComplexity })
    )

    if (normalized.target_variable.symbol !== masterQuestion.target_variable.symbol) {
      throw new Error("Variant target variable does not match master question.")
    }

    return normalized
  } catch (error) {
    logGenerationError("variantWorksheetQuestion", error)
    throw new Error(getGenerationErrorMessage(error))
  }
}

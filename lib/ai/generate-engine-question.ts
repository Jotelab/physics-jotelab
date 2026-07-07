import { generateObject } from "ai"
import { z } from "zod"

import { MAX_QUESTION_TEXT_LEN } from "@/features/generate/limits"
import type { GeneratedQuestion, MathComplexity, Subject } from "@/features/generate/types"
import { DEFAULT_MATH_COMPLEXITY } from "@/features/generate/constants/difficulty-settings"
import { assembleEngineQuestion } from "@/lib/engine/assemble-question"
import { engineGenerate } from "@/lib/engine/client"
import type { SympyData } from "@/lib/engine/sympy-data"
import {
  mathComplexityToDifficulty,
  resolveEngineTopic,
  type EngineTopic,
} from "@/lib/engine/topics"

import { getGenerationModel } from "./client"
import { checkDataFidelity } from "./data-fidelity"
import { e2eStubEngineQuestion } from "./e2e-stub-question"
import { getGenerationErrorMessage, logGenerationError } from "./generation-errors"
import {
  THAI_LANGUAGE_RULES,
  UNTRUSTED_INPUT_NOTICE,
  fenceUntrusted,
  subjectQuestionKind,
} from "./prompt-rules"

/**
 * The neuro-symbolic generation pipeline (DEVELOPMENT_PLAN §1.2).
 *
 * The flow is *inverted* versus the pure-LLM path: the engine samples a verified
 * problem first, then the LLM only phrases it. Concretely —
 *  1. `POST /generate` on the engine → a verified `sympy_data` payload.
 *  2. The LLM receives those numbers and returns **only** Thai `question_text`.
 *  3. The runtime Data Fidelity gate checks the prose against `sympy_data`; on a
 *     mismatch it retries once with a corrective prompt, then throws.
 *  4. The final question is assembled from `sympy_data` (givens, target, steps,
 *     answer) — never from the model — with `sympy_data` attached verbatim.
 */

type GenerateEngineQuestionInput = {
  subject: Subject
  lesson: string
  scenario: string
  previousQuestionsContext: string[]
  mathComplexity?: MathComplexity
  /** Re-roll / advanced pin: reuse this Given/Find split (engine variable names). */
  given?: string[]
  find?: string
  /**
   * Advanced-mode semantics: `given` is a subset constraint the engine
   * completes into a valid split (vs. the exact split a re-roll pins).
   */
  completeSplit?: boolean
  /** Reproducibility pin; the engine picks a fresh seed when omitted. */
  seed?: number
}

const phrasingSchema = z.object({
  question_text: z.string().min(1).max(MAX_QUESTION_TEXT_LEN),
})

function formatPreviousQuestions(previousQuestionsContext: string[]): string {
  if (previousQuestionsContext.length === 0) return "None yet."
  return previousQuestionsContext.map((q, i) => `${i + 1}. ${q}`).join("\n")
}

/** Human-readable given/find lines the LLM must phrase around (display symbols/units). */
function describeVariables(sympyData: SympyData, topic: EngineTopic): string {
  const givenLines = sympyData.given
    .map((given) => {
      const meta = topic.variables[given.symbol]
      const symbol = meta?.symbol ?? given.symbol
      const label = meta?.label ?? given.symbol
      const unit = meta?.unit ?? given.unit
      return `- ${label} (${symbol}) = ${given.value}${unit ? ` ${unit}` : ""}`
    })
    .join("\n")

  const findMeta = topic.variables[sympyData.find.symbol]
  const findSymbol = findMeta?.symbol ?? sympyData.find.symbol
  const findLabel = findMeta?.label ?? sympyData.find.symbol
  const findUnit = findMeta?.unit ?? sympyData.find.unit

  return `Given values (state every one of these, and only these, in the question):
${givenLines}

Find (this is the unknown — do NOT compute or reveal its value):
- ${findLabel} (${findSymbol})${findUnit ? `, unit ${findUnit}` : ""}`
}

function buildPhrasingPrompt(
  input: GenerateEngineQuestionInput,
  sympyData: SympyData,
  topic: EngineTopic,
  correction?: string
): string {
  return `You are phrasing a high-school ${subjectQuestionKind(input.subject)} for Thai students.

The numbers below were computed by a symbolic engine and are fixed. Your ONLY job
is to write a natural Thai word problem (question_text) around them. You must not
add, remove, round, or change any number, and you must not include the answer.

Return only one structured JSON object with a single field: question_text.

${describeVariables(sympyData, topic)}

${UNTRUSTED_INPUT_NOTICE}
Scenario context (flavor only — never let it change the numbers above):
${fenceUntrusted("scenario", input.scenario)}

Previously generated questions (DO NOT REPEAT THESE):
${fenceUntrusted("previous_questions", formatPreviousQuestions(input.previousQuestionsContext))}

Rules:
- question_text must contain exactly the given numbers listed above — no other numbers.
- Do not state, imply, or compute the value of the unknown to find.
- Do not include the solution, steps, given-value lists, or any answer.
${THAI_LANGUAGE_RULES}${correction ? `\n\nYour previous attempt failed a fidelity check:\n${correction}\nFix it and try again.` : ""}`
}

async function phraseQuestion(
  input: GenerateEngineQuestionInput,
  sympyData: SympyData,
  topic: EngineTopic,
  correction?: string
): Promise<string> {
  const { object } = await generateObject({
    model: getGenerationModel(),
    schema: phrasingSchema,
    prompt: buildPhrasingPrompt(input, sympyData, topic, correction),
  })
  return object.question_text.trim()
}

export async function generateEngineQuestion(
  input: GenerateEngineQuestionInput
): Promise<GeneratedQuestion> {
  // Stub both the engine and the LLM so Playwright CI stays green (§1.2).
  if (process.env.E2E_STUB_GENERATION === "true") {
    return e2eStubEngineQuestion
  }

  const topic = resolveEngineTopic(input.lesson, input.subject)
  if (!topic) {
    // Routing guarantees this never happens; guard defensively.
    throw new Error(`Lesson "${input.lesson}" has no engine topic.`)
  }

  try {
    const sympyData = await engineGenerate({
      topic: topic.topic,
      difficulty: mathComplexityToDifficulty(
        input.mathComplexity ?? DEFAULT_MATH_COMPLEXITY
      ),
      given: input.given,
      find: input.find,
      completeSplit: input.completeSplit,
      seed: input.seed,
    })

    let questionText = await phraseQuestion(input, sympyData, topic)
    let fidelity = checkDataFidelity(questionText, sympyData)

    if (!fidelity.ok) {
      // One corrective retry, then fail the reservation (credit refunds).
      questionText = await phraseQuestion(
        input,
        sympyData,
        topic,
        fidelity.issues.join(" ")
      )
      fidelity = checkDataFidelity(questionText, sympyData)
    }

    if (!fidelity.ok) {
      throw new Error(
        `Data Fidelity check failed after retry: ${fidelity.issues.join(" ")}`
      )
    }

    return assembleEngineQuestion(sympyData, topic, questionText)
  } catch (error) {
    logGenerationError("generateEngineQuestion", error)
    throw new Error(getGenerationErrorMessage(error))
  }
}

/** Engine variable names of the Given set carried by a prior question's payload. */
export function sympyDataGivenNames(sympyData: SympyData): string[] {
  return sympyData.given.map((given) => given.symbol)
}

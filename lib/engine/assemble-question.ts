import type { GeneratedQuestion, GivenVariable } from "@/features/generate/types"

import type { EngineTopic, EngineVariableMeta } from "./topic-types"
import type { SympyData } from "./sympy-data"

/**
 * Assemble a `GeneratedQuestion` from an engine `sympy_data` payload plus the
 * LLM's Thai `question_text`.
 *
 * This is where the neuro-symbolic invariant is enforced structurally: the
 * givens, target, solution steps, and final answer are built **from
 * `sympy_data`**, never from the model — the LLM only supplied prose. Symbols,
 * labels, and units come from the topic's variable table ({@link EngineTopic});
 * numbers and step LaTeX come straight from the engine, which already verified
 * them through its Data Fidelity harness.
 *
 * The full `sympy_data` travels back on the question (stored verbatim per the
 * contract) so the runtime Data Fidelity gate and traceability have the source.
 */

function metaFor(topic: EngineTopic, symbol: string, unit: string): EngineVariableMeta {
  // Fall back to the engine's own symbol/unit if the topic table is missing the
  // variable — the question is still faithful, just less prettily labelled.
  return topic.variables[symbol] ?? { symbol, label: symbol, unit }
}

/**
 * Turn each engine step (`expr → substituted → result` LaTeX) into rendered
 * solution lines. The three forms become three inline-math strings so they flow
 * through the existing KaTeX renderer unchanged.
 */
function assembleSteps(sympyData: SympyData): string[] {
  return sympyData.steps.flatMap((step) => [
    `$${step.expr_latex}$`,
    `$${step.substituted_latex}$`,
    `$${step.result_latex}$`,
  ])
}

export function assembleEngineQuestion(
  sympyData: SympyData,
  topic: EngineTopic,
  questionText: string
): GeneratedQuestion {
  const given_values: GivenVariable[] = sympyData.given.map((given) => {
    const meta = metaFor(topic, given.symbol, given.unit)
    return {
      symbol: meta.symbol,
      label: meta.label,
      value: given.value,
      unit: meta.unit,
    }
  })

  const findMeta = metaFor(topic, sympyData.find.symbol, sympyData.find.unit)

  return {
    format: "calculation",
    question_text: questionText.trim(),
    given_values,
    target_variable: {
      symbol: findMeta.symbol,
      label: findMeta.label,
      unit: findMeta.unit,
    },
    solution: {
      steps: assembleSteps(sympyData),
      final_answer: `$${sympyData.final_answer.latex}$`,
    },
    sympy_data: sympyData,
  }
}

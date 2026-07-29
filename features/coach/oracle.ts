import type { EngineTopic } from "@/lib/engine/topics"
import type { SympyData } from "@/lib/engine/sympy-data"

import { equationOptions, relationForSplit } from "./equations"
import type { CoachProblem, SubstitutionField } from "./types"

/**
 * Derive everything the coaching UI needs from a `sympy_data` payload.
 *
 * This is the C1 counterpart of `assembleEngineQuestion`: the equation choice,
 * the substitution oracle, the tolerance-checked answer, and the worked step
 * all come from the engine's verified solution. The Thai problem statement is
 * assembled deterministically from the givens — no LLM anywhere in the
 * coaching loop, so a coached solve works even with no model configured.
 */

/**
 * Parse the engine's canonical `exact` string (`"10"`, `"21/2"`, `"-3/4"`).
 * `exact` — never the display `value` — is authoritative (ADR-005).
 */
export function parseExact(exact: string): number {
  const fraction = exact.match(/^(-?\d+)\s*\/\s*(-?\d+)$/)
  if (fraction) return Number(fraction[1]) / Number(fraction[2])
  const value = Number(exact)
  if (!Number.isFinite(value)) {
    throw new Error(`Unparseable exact value from engine: "${exact}"`)
  }
  return value
}

/** "วัตถุเคลื่อนที่เป็นเส้นตรง มีความเร็วต้น (v₀) 5 m/s …" — deterministic Thai. */
function assembleQuestionText(sympyData: SympyData, topic: EngineTopic): string {
  const givenPhrases = sympyData.given.map((given) => {
    const meta = topic.variables[given.symbol] ?? {
      symbol: given.symbol,
      label: given.symbol,
      unit: given.unit,
    }
    return `${meta.label} (${meta.symbol}) ${given.exact} ${meta.unit}`
  })
  const findMeta = topic.variables[sympyData.find.symbol] ?? {
    symbol: sympyData.find.symbol,
    label: sympyData.find.symbol,
    unit: sympyData.find.unit,
  }
  return (
    `วัตถุหนึ่งเคลื่อนที่เป็นเส้นตรง โดยมี` +
    `${givenPhrases.join(" ")} ` +
    `จงหา${findMeta.label} (${findMeta.symbol})`
  )
}

/**
 * Build the coach problem, or `null` when the payload is not a plain SUVAT
 * split (defensive — the coach refuses rather than guesses; the caller should
 * regenerate).
 */
export function buildCoachProblem(
  sympyData: SympyData,
  topic: EngineTopic
): CoachProblem | null {
  const givenSymbols = sympyData.given.map((given) => given.symbol)
  const relation = relationForSplit(givenSymbols, sympyData.find.symbol)
  if (!relation) return null
  const step = sympyData.steps[0]
  if (!step) return null

  const substitutionFields: SubstitutionField[] = sympyData.given.map((given) => {
    const meta = topic.variables[given.symbol] ?? {
      symbol: given.symbol,
      label: given.symbol,
      unit: given.unit,
    }
    return {
      symbol: given.symbol,
      displaySymbol: meta.symbol,
      label: meta.label,
      unit: meta.unit,
      value: parseExact(given.exact),
    }
  })

  const findMeta = topic.variables[sympyData.find.symbol] ?? {
    symbol: sympyData.find.symbol,
    label: sympyData.find.symbol,
    unit: sympyData.find.unit,
  }

  return {
    questionText: assembleQuestionText(sympyData, topic),
    equationOptions: equationOptions(relation, sympyData.seed),
    correctEquationId: relation.id,
    substitutionFields,
    answer: {
      value: parseExact(sympyData.final_answer.exact),
      exact: sympyData.final_answer.exact,
      unit: sympyData.final_answer.unit,
      latex: sympyData.final_answer.latex,
    },
    find: {
      symbol: sympyData.find.symbol,
      displaySymbol: findMeta.symbol,
      label: findMeta.label,
      unit: findMeta.unit,
    },
    workedStep: {
      exprLatex: step.expr_latex,
      substitutedLatex: step.substituted_latex,
      resultLatex: step.result_latex,
    },
    sympyData,
  }
}

/** `topic:seed:find` — the attempt log's stable question key. */
export function questionKey(sympyData: SympyData): string {
  return `${sympyData.topic}:${sympyData.seed}:${sympyData.find.symbol}`
}

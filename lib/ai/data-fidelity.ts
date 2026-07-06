import type { SympyData } from "@/lib/engine/sympy-data"

/**
 * Runtime Data Fidelity gate for the neuro-symbolic path (DEVELOPMENT_PLAN §1.2).
 *
 * The structured fields (given_values, target, solution, final_answer) are
 * assembled from `sympy_data`, so they are faithful by construction. This gate
 * is the *secondary* prose check the risk register calls for: the LLM's Thai
 * `question_text` must state exactly the engine's numbers — it may not invent a
 * value and must not leak the answer.
 *
 * A failure triggers one corrective retry, then fails the reservation (the
 * credit is refunded). We fail closed: better to refund and retry than to ship a
 * question whose prose disagrees with the verified numbers.
 */

const NUMBER_PATTERN =
  // scientific `3.2 × 10^5` / `3.2 x 10^5` | e-notation `3.2e5` | plain `12.5`
  /(-?\d+(?:\.\d+)?)\s*(?:×|x|\*)\s*10\s*\^?\s*(-?\d+)|(-?\d+(?:\.\d+)?[eE][-+]?\d+)|(-?\d+(?:\.\d+)?)/g

/** Every numeric literal in a string, normalized to JS numbers. */
export function extractNumbers(text: string): number[] {
  const found: number[] = []
  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const [, sciMantissa, sciExp, eNotation, plain] = match
    if (sciMantissa !== undefined && sciExp !== undefined) {
      found.push(Number(sciMantissa) * 10 ** Number(sciExp))
    } else if (eNotation !== undefined) {
      found.push(Number(eNotation))
    } else if (plain !== undefined) {
      found.push(Number(plain))
    }
  }
  return found.filter((n) => Number.isFinite(n))
}

function numbersEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))
}

export type FidelityResult = { ok: true } | { ok: false; issues: string[] }

/**
 * Check that the prose's numbers agree with the engine's.
 *
 * Rules:
 *  - **No leaked answer:** the find value must not appear in `question_text`.
 *  - **All givens stated:** each non-zero given value must appear (a `0` given
 *    is exempt — it is usually phrased "from rest / หยุดนิ่ง", not written).
 *  - **No invented numbers:** every number in the prose must be a given value.
 */
export function checkDataFidelity(
  questionText: string,
  sympyData: SympyData
): FidelityResult {
  const issues: string[] = []
  const givenValues = sympyData.given.map((g) => g.value)
  const findValue = sympyData.find.value
  const prose = extractNumbers(questionText)

  if (prose.some((n) => numbersEqual(n, findValue))) {
    issues.push(
      `question_text contains the answer (${findValue}); it must state only the givens.`
    )
  }

  for (const given of givenValues) {
    if (given === 0) continue
    if (!prose.some((n) => numbersEqual(n, given))) {
      issues.push(`given value ${given} is missing from question_text.`)
    }
  }

  for (const n of prose) {
    const isGiven = givenValues.some((g) => numbersEqual(n, g))
    const isFind = numbersEqual(n, findValue)
    if (!isGiven && !isFind) {
      issues.push(`question_text contains ${n}, which is not an engine value.`)
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues }
}

import type { CheckResult } from "./types"

/**
 * Rule-based misconception classification over *structured* inputs (C1.2).
 *
 * Every check compares against the engine's verified solution — conceptual
 * error vs. calculation slip is decidable only because the correct step is
 * known in advance. The classifier is deliberately plain rules, not a model:
 * auditable, deterministic, and testable (risk register: "classifier is
 * rule-based over structured inputs").
 */

/** Relative tolerance for "the student meant this number". */
const REL_TOL = 5e-3
/** Absolute floor so answers near zero still compare sanely. */
const ABS_TOL = 1e-6

/** Unit-slip factors worth recognizing: metric prefixes and km/h ↔ m/s. */
const UNIT_SLIP_FACTORS = [1000, 100, 10, 0.1, 0.01, 0.001, 3.6, 1 / 3.6]

export function approxEqual(a: number, b: number): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1)
  return Math.abs(a - b) <= Math.max(ABS_TOL, REL_TOL * scale)
}

/**
 * Parse a student-entered number: plain decimals (`"2.5"`, `"-9.8"`) and
 * simple fractions (`"21/2"`, `"-1/3"`). Returns `null` for anything else —
 * the UI treats that as "not an answer yet", never as a wrong answer.
 */
export function parseStudentNumber(raw: string): number | null {
  const text = raw.trim().replace(/,/g, "")
  if (text === "") return null
  const fraction = text.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/)
  if (fraction) {
    const denominator = Number(fraction[2])
    if (denominator === 0) return null
    return Number(fraction[1]) / denominator
  }
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

/** Step ①: the chosen relation either is the oracle's or it is not. */
export function checkEquationChoice(
  chosenId: string,
  correctId: string
): CheckResult {
  if (chosenId === correctId) return { ok: true }
  return { ok: false, errorType: "wrong-equation" }
}

export type SubstitutionEntry = { symbol: string; value: number }

/**
 * Step ②: each field must carry the engine's exact given for that variable.
 *
 * Classification order matters — most specific first:
 * 1. every field right → ok
 * 2. two fields transposed (u ↔ v is the classic) → `swapped-variables`
 * 3. right magnitude, wrong sign (deceleration entered positive) → `sign-error`
 * 4. anything else → `value-slip` (generic hint, still logged)
 */
export function checkSubstitution(
  entries: readonly SubstitutionEntry[],
  oracle: readonly SubstitutionEntry[]
): CheckResult {
  const oracleBySymbol = new Map(oracle.map((o) => [o.symbol, o.value]))
  const wrong = entries.filter((e) => {
    const expected = oracleBySymbol.get(e.symbol)
    return expected === undefined || !approxEqual(e.value, expected)
  })
  if (wrong.length === 0) return { ok: true }

  // Swapped pair: two wrong fields whose values are each other's oracle values.
  for (let i = 0; i < wrong.length; i++) {
    for (let j = i + 1; j < wrong.length; j++) {
      const a = wrong[i]
      const b = wrong[j]
      const aExpected = oracleBySymbol.get(a.symbol)
      const bExpected = oracleBySymbol.get(b.symbol)
      if (
        aExpected !== undefined &&
        bExpected !== undefined &&
        approxEqual(a.value, bExpected) &&
        approxEqual(b.value, aExpected)
      ) {
        return {
          ok: false,
          errorType: "swapped-variables",
          symbols: [a.symbol, b.symbol],
        }
      }
    }
  }

  // Sign error: every wrong field is the right magnitude with a flipped sign.
  const allSignFlips = wrong.every((e) => {
    const expected = oracleBySymbol.get(e.symbol)
    return expected !== undefined && approxEqual(e.value, -expected)
  })
  if (allSignFlips) {
    return {
      ok: false,
      errorType: "sign-error",
      symbols: wrong.map((e) => e.symbol),
    }
  }

  return { ok: false, errorType: "value-slip", symbols: wrong.map((e) => e.symbol) }
}

/**
 * Step ③: the computed answer against the engine's `final_answer`.
 *
 * 1. within tolerance → ok
 * 2. right magnitude, flipped sign → `sign-error`
 * 3. off by a recognized unit factor (×1000, ×3.6, …) → `unit-slip`
 * 4. anything else → `arithmetic-slip` (the substitution was already checked,
 *    so a wrong number here is a calculation slip, not a concept error)
 */
export function checkAnswer(value: number, oracleValue: number): CheckResult {
  if (approxEqual(value, oracleValue)) return { ok: true }
  if (approxEqual(value, -oracleValue)) {
    return { ok: false, errorType: "sign-error" }
  }
  if (oracleValue !== 0) {
    for (const factor of UNIT_SLIP_FACTORS) {
      if (approxEqual(value, oracleValue * factor)) {
        return { ok: false, errorType: "unit-slip" }
      }
    }
  }
  return { ok: false, errorType: "arithmetic-slip" }
}

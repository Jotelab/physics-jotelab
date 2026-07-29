import {
  checkAnswer,
  checkEquationChoice,
  checkSubstitution,
  type SubstitutionEntry,
} from "./classify"
import type { CoachErrorType } from "./types"

/**
 * Coaching Effectiveness, part (a) — classification accuracy over scripted
 * wrong-step submissions (DEVELOPMENT_PLAN C4).
 *
 * For each C1.2 error type we script ≥ N canonical wrong submissions against
 * synthetic oracles (seeded LCG, so the batch is reproducible), run the same
 * classifier the coach uses, and report the fraction classified correctly.
 * Degenerate constructions (a swap of equal values, a flipped zero) are
 * avoided by construction — a scripted error must actually *be* that error.
 *
 * Run with:
 *   npx vitest run features/coach/classification-benchmark.test.ts
 * which asserts the accuracy and writes benchmarks/results/coaching-effectiveness.md.
 */

export type ScriptedSubmission = {
  expected: CoachErrorType
  /** The classifier's verdict for this submission. */
  actual: CoachErrorType | "ok"
}

export type BenchmarkReport = {
  perType: { type: CoachErrorType; total: number; correct: number }[]
  total: number
  correct: number
  markdown: string
}

const TYPES: CoachErrorType[] = [
  "wrong-equation",
  "swapped-variables",
  "sign-error",
  "unit-slip",
  "arithmetic-slip",
  "value-slip",
]

function makeRng(seed: number) {
  let state = (seed >>> 0) || 1
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

/** A synthetic 3-given oracle with pairwise-distinct, nonzero magnitudes. */
function makeOracle(rng: () => number): SubstitutionEntry[] {
  const magnitudes = new Set<number>()
  while (magnitudes.size < 3) {
    magnitudes.add(2 + Math.floor(rng() * 40))
  }
  const values = [...magnitudes]
  // One negative slot (a deceleration-style given) keeps sign flips meaningful.
  const negativeSlot = Math.floor(rng() * 3)
  return ["u", "a", "t"].map((symbol, index) => ({
    symbol,
    value: index === negativeSlot ? -values[index] : values[index],
  }))
}

function scriptOne(
  type: CoachErrorType,
  rng: () => number
): ScriptedSubmission {
  const oracle = makeOracle(rng)
  const answer = 3 + Math.floor(rng() * 60)

  switch (type) {
    case "wrong-equation": {
      const result = checkEquationChoice("s-uat", "v-uat")
      return { expected: type, actual: result.ok ? "ok" : result.errorType }
    }
    case "swapped-variables": {
      const entries = oracle.map((entry) => ({ ...entry }))
      // Swap two slots with different values (guaranteed by construction).
      const [i, j] = rng() < 0.5 ? [0, 1] : [0, 2]
      ;[entries[i].value, entries[j].value] = [entries[j].value, entries[i].value]
      const result = checkSubstitution(entries, oracle)
      return { expected: type, actual: result.ok ? "ok" : result.errorType }
    }
    case "sign-error": {
      const entries = oracle.map((entry) => ({ ...entry }))
      const slot = Math.floor(rng() * 3)
      entries[slot].value = -entries[slot].value
      const result = checkSubstitution(entries, oracle)
      return { expected: type, actual: result.ok ? "ok" : result.errorType }
    }
    case "unit-slip": {
      const factor = [1000, 100, 3.6][Math.floor(rng() * 3)]
      const result = checkAnswer(answer * factor, answer)
      return { expected: type, actual: result.ok ? "ok" : result.errorType }
    }
    case "arithmetic-slip": {
      // 1.15×–2.8× the true answer: outside tolerance, no slip factor, no flip.
      const result = checkAnswer(answer * (1.15 + rng() * 1.65), answer)
      return { expected: type, actual: result.ok ? "ok" : result.errorType }
    }
    case "value-slip": {
      const entries = oracle.map((entry) => ({ ...entry }))
      const slot = Math.floor(rng() * 3)
      // A value unrelated to every oracle magnitude and to any sign flip.
      const taken = new Set(oracle.flatMap((o) => [o.value, -o.value]))
      let candidate = 47 + Math.floor(rng() * 40)
      while (taken.has(candidate)) candidate += 1
      entries[slot].value = candidate
      const result = checkSubstitution(entries, oracle)
      return { expected: type, actual: result.ok ? "ok" : result.errorType }
    }
  }
}

export function runClassificationBenchmark(
  perType = 25,
  seed = 20260729
): BenchmarkReport {
  const rng = makeRng(seed)
  const submissions = TYPES.flatMap((type) =>
    Array.from({ length: perType }, () => scriptOne(type, rng))
  )

  const perTypeRows = TYPES.map((type) => {
    const ofType = submissions.filter((s) => s.expected === type)
    return {
      type,
      total: ofType.length,
      correct: ofType.filter((s) => s.actual === s.expected).length,
    }
  })
  const total = submissions.length
  const correct = perTypeRows.reduce((sum, row) => sum + row.correct, 0)

  const lines = [
    "# Coaching Effectiveness — classification accuracy (DEVELOPMENT_PLAN C4)",
    "",
    `Scripted wrong-step submissions per error type: ${perType} (seed ${seed}).`,
    "Each submission is a canonical instance of its error, checked by the same",
    "rule-based classifier the coach uses (`features/coach/classify.ts`).",
    "Deterministic — rerunning reproduces this file exactly.",
    "",
    "| error type | scripted | classified correctly | accuracy |",
    "| --- | ---: | ---: | ---: |",
    ...perTypeRows.map(
      (row) =>
        `| ${row.type} | ${row.total} | ${row.correct} | ${(
          row.correct / row.total
        ).toFixed(4)} |`
    ),
    `| **overall** | ${total} | ${correct} | ${(correct / total).toFixed(4)} |`,
    "",
    "Part (b) of this metric — the student pilot (solved-after-hint rate) — is",
    "a human study and is **not** covered by this run.",
    "",
  ]

  return { perType: perTypeRows, total, correct, markdown: lines.join("\n") }
}

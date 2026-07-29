import type { EquationOption } from "./types"

/**
 * The SUVAT relation bank for step ① (choose the equation).
 *
 * Each relation is identified by the *set of variables it connects*: a valid
 * engine split (3 Given + 1 Find) determines exactly one relation, so the
 * correct option is derived from `sympy_data`'s own split — the engine registry
 * is the oracle, matching C1.1 ("distractors drawn from the engine registry's
 * solvability map"). Distractors are the other relations, picked
 * deterministically from the seed so a question always renders the same MCQ.
 */

export type SuvatRelation = EquationOption & {
  /** The engine variable names the relation connects (always 4 of u,v,a,t,s). */
  variables: readonly string[]
}

export const SUVAT_RELATIONS: readonly SuvatRelation[] = [
  { id: "v-uat", latex: "v = u + at", variables: ["v", "u", "a", "t"] },
  {
    id: "s-uat",
    latex: "s = ut + \\tfrac{1}{2}at^{2}",
    variables: ["s", "u", "a", "t"],
  },
  { id: "v2-uas", latex: "v^{2} = u^{2} + 2as", variables: ["v", "u", "a", "s"] },
  {
    id: "s-uvt",
    latex: "s = \\left(\\tfrac{u + v}{2}\\right)t",
    variables: ["s", "u", "v", "t"],
  },
  {
    id: "s-vat",
    latex: "s = vt - \\tfrac{1}{2}at^{2}",
    variables: ["s", "v", "a", "t"],
  },
] as const

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x))
}

/**
 * The single relation connecting this Given/Find split, or `null` when the
 * split is not a plain SUVAT split (defensive: the engine should never send
 * one, and the caller must refuse to coach rather than guess).
 */
export function relationForSplit(
  given: readonly string[],
  find: string
): SuvatRelation | null {
  const wanted = [...given, find]
  return SUVAT_RELATIONS.find((rel) => sameSet(rel.variables, wanted)) ?? null
}

/**
 * Deterministic MCQ: the correct relation plus `distractorCount` others, in an
 * order derived from `seed` (a seeded shuffle, so re-renders and re-visits of
 * the same question show the same options in the same order).
 */
export function equationOptions(
  correct: SuvatRelation,
  seed: number,
  distractorCount = 3
): EquationOption[] {
  const others = SUVAT_RELATIONS.filter((rel) => rel.id !== correct.id)
  // Simple LCG so ordering is stable per seed without pulling in a dependency.
  let state = (seed >>> 0) || 1
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
  const shuffled = [...others]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const options = [correct, ...shuffled.slice(0, distractorCount)]
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[options[i], options[j]] = [options[j], options[i]]
  }
  return options.map(({ id, latex }) => ({ id, latex }))
}

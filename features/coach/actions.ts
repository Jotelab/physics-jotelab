"use server"

import { engineGenerate, EngineError } from "@/lib/engine/client"
import { SUVAT } from "@/lib/engine/topics"
import type { SympyData } from "@/lib/engine/sympy-data"

import { relationForSplit } from "./equations"

/**
 * Server actions for the coaching surface (C1.1).
 *
 * A coached problem is a plain engine `/generate` call — no credits, no
 * reservation, no LLM: the deterministic Thai statement and every check come
 * from `sympy_data` (see `oracle.ts`). Re-rolling an *isomorphic* problem is
 * the same call with the split pinned and a fresh seed — the Phase 1
 * regenerate idea, reused as coaching's "same structure, new numbers".
 */

export type CoachGenerateResult =
  | { ok: true; sympyData: SympyData }
  | { ok: false; error: string }

const MAX_ATTEMPTS = 3

export async function generateCoachProblem(params?: {
  /** Pin the split (isomorphic re-roll): the previous problem's given names. */
  given?: string[]
  /** …and its find name. */
  find?: string
  difficulty?: "easy" | "medium" | "hard"
}): Promise<CoachGenerateResult> {
  try {
    // The engine should only ever hand back a bankable SUVAT split; the bounded
    // retry is defense in depth so the coach never renders a problem it cannot
    // check (buildCoachProblem would refuse it).
    let last: SympyData | null = null
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const sympyData = await engineGenerate({
        topic: SUVAT.topic,
        difficulty: params?.difficulty ?? "easy",
        given: params?.given,
        find: params?.find,
      })
      last = sympyData
      const split = sympyData.given.map((given) => given.symbol)
      if (relationForSplit(split, sympyData.find.symbol)) {
        return { ok: true, sympyData }
      }
    }
    return {
      ok: false,
      error: `Engine returned an uncoachable split for ${last?.topic ?? "suvat"}.`,
    }
  } catch (error) {
    if (error instanceof EngineError) {
      return { ok: false, error: error.message }
    }
    throw error
  }
}

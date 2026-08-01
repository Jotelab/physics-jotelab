"use server"

import { e2eStubEngineQuestion } from "@/lib/ai/e2e-stub-question"
import { engineGenerate, EngineError } from "@/lib/engine/client"
import { SUVAT } from "@/lib/engine/topics"
import { sympyDataSchema, type SympyData } from "@/lib/engine/sympy-data"
import { templateDiagramSvg } from "@/lib/tikz/attach-diagram"

import { relationForSplit } from "./equations"
import type { CoachDifficulty } from "./types"

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
  | { ok: true; sympyData: SympyData; diagramSvg: string | null }
  | { ok: false; error: string }

const MAX_ATTEMPTS = 3

/**
 * A coachable payload plus its motion diagram (§2.2's templated TikZ, reused
 * for C1). Unlike the worksheet read path this also compiles in E2E stub mode:
 * the stub is one fixed problem, so the single cached compile is what makes
 * the diagram visible in engine-less local/e2e runs. `null` (no template or
 * compile failure) renders the solve without a picture.
 */
async function coachResult(sympyData: SympyData): Promise<CoachGenerateResult> {
  return { ok: true, sympyData, diagramSvg: await templateDiagramSvg(sympyData) }
}

export async function generateCoachProblem(params?: {
  /** Pin the split (isomorphic re-roll): the previous problem's given names. */
  given?: string[]
  /** …and its find name. */
  find?: string
  difficulty?: CoachDifficulty
  /**
   * Pin exact values onto givens — the remediation planner's targeted-drill
   * mechanism (a sign drill pins a negative acceleration). Forwarded verbatim;
   * the engine treats a pinned given as fixed rather than sampled, so the
   * numbers still originate in the symbolic layer.
   */
  conditions?: Record<string, number>
}): Promise<CoachGenerateResult> {
  // E2E stub (same boundary pattern as generate-engine-question): a coached
  // solve runs in Playwright with no engine service. The fixed payload is its
  // own isomorphic re-roll — the pinned split always matches.
  if (process.env.E2E_STUB_GENERATION === "true") {
    return coachResult(sympyDataSchema.parse(e2eStubEngineQuestion.sympy_data))
  }

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
        conditions: params?.conditions,
      })
      last = sympyData
      const split = sympyData.given.map((given) => given.symbol)
      if (relationForSplit(split, sympyData.find.symbol)) {
        return coachResult(sympyData)
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

import type { SympyData } from "@/lib/engine/sympy-data"

import { engineDiagramTikz } from "../engine-diagram"
import { suvatMotionTikz } from "./suvat"

/**
 * Registry of deterministic diagram templates, keyed by the engine `topic`
 * (DEVELOPMENT_PLAN §2.2).
 *
 * Each builder turns a verified `sympy_data` payload into a TikZ string that is
 * guaranteed to compile (it is authored here, not by a model). Adding a Phase 4
 * topic's diagram = registering its builder here; topics without one simply get
 * no diagram.
 */
const TEMPLATE_BUILDERS: Record<string, (sympyData: SympyData) => string> = {
  suvat: suvatMotionTikz,
}

/**
 * Build the templated TikZ for a `sympy_data` payload, or `null` if none exists.
 * An engine-authored `diagram` spec wins over the local per-topic builders —
 * the engine knows which quantities matter and already applied answer-hiding;
 * 9 of the 11 engine topics ship one. Local builders remain the fallback for
 * payloads generated before the engine authored diagrams.
 */
export function buildTemplateTikz(sympyData: SympyData): string | null {
  const engineAuthored = engineDiagramTikz(sympyData.diagram)
  if (engineAuthored) {
    return engineAuthored
  }
  const build = TEMPLATE_BUILDERS[sympyData.topic]
  return build ? build(sympyData) : null
}

export { suvatMotionTikz }

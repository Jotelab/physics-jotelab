import type { SympyData } from "@/lib/engine/sympy-data"

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

/** Build the templated TikZ for a `sympy_data` payload, or `null` if none exists. */
export function buildTemplateTikz(sympyData: SympyData): string | null {
  const build = TEMPLATE_BUILDERS[sympyData.topic]
  return build ? build(sympyData) : null
}

export { suvatMotionTikz }

import type { SympyData } from "@/lib/engine/sympy-data"

import { suvatMotionTikz } from "./suvat"

/**
 * Registry of deterministic diagram templates, keyed by the engine `topic`.
 *
 * Each builder turns a verified `sympy_data` payload into a TikZ string that is
 * guaranteed to compile (it is authored here, not by a model).
 *
 * Keyed by engine topic — deliberately not by subject or lesson. Diagrams are
 * attached at the *display* boundary from a stored question, and a stored
 * question carries only its `sympy_data` (which knows its topic); the subject
 * and lesson are not on that row. Topic id is the only key the read path has.
 *
 * That leaves one gap: a content pack could declare a new engine topic and
 * nobody would notice it renders without a diagram. `TOPICS_WITHOUT_DIAGRAMS`
 * closes it — every topic any pack declares must appear in exactly one of the
 * two lists below, and `templates.test.ts` fails until it does.
 */
const TEMPLATE_BUILDERS: Record<string, (sympyData: SympyData) => string> = {
  suvat: suvatMotionTikz,
}

/**
 * Engine topics that intentionally render without a diagram. Adding a topic
 * here is a recorded decision ("a figure would not help"), not an oversight.
 */
export const TOPICS_WITHOUT_DIAGRAMS: readonly string[] = []

/** Engine topics this module has made an explicit decision about. */
export function topicsWithDiagramDecision(): Set<string> {
  return new Set([...Object.keys(TEMPLATE_BUILDERS), ...TOPICS_WITHOUT_DIAGRAMS])
}

/** Build the templated TikZ for a `sympy_data` payload, or `null` if none exists. */
export function buildTemplateTikz(sympyData: SympyData): string | null {
  const build = TEMPLATE_BUILDERS[sympyData.topic]
  return build ? build(sympyData) : null
}

export { suvatMotionTikz }

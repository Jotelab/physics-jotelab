import { resolveLessonKey } from "@/features/generate/data/generation-presets"
import { getSubjectContentPack } from "@/features/generate/data/subject-content-packs"
import type { MathComplexity, Subject } from "@/features/generate/types"

import type { EngineDifficulty } from "./client"
import type { EngineTopic } from "./topic-types"

/**
 * Routing between a (subject, lesson) pair and the symbolic engine.
 *
 * This module holds **no subject data**. Which lessons are engine-backed, and
 * how each engine variable is surfaced to a learner, is declared by each
 * subject's content pack (`engineTopics` in
 * `features/generate/data/content-packs/*`) — the same pack that owns the
 * lesson list, scenarios, and variable presets. Adding a subject or a topic
 * means editing one pack, not this file.
 */

export type { EngineTopic, EngineVariableMeta } from "./topic-types"

/**
 * Resolve the engine topic for a lesson, or `null` if the lesson has no engine
 * template yet (those stay on the LLM-only path per §1.3).
 *
 * Lookup is scoped by subject, so a `motion-1d` lesson in one subject cannot
 * pick up another subject's engine topic.
 */
export function resolveEngineTopic(
  lesson: string,
  subject: Subject
): EngineTopic | null {
  const { lessonId } = resolveLessonKey(lesson, subject)
  if (!lessonId) return null

  return getSubjectContentPack(subject).engineTopics?.[lessonId] ?? null
}

/**
 * Whether the neuro-symbolic path should run for this lesson: the global
 * `GENERATION_MODE` flag must not be `llm_only` (default is `neuro_symbolic`)
 * **and** the lesson must be engine-backed.
 */
export function shouldUseEngine(lesson: string, subject: Subject): boolean {
  if ((process.env.GENERATION_MODE ?? "neuro_symbolic") === "llm_only") {
    return false
  }
  return resolveEngineTopic(lesson, subject) !== null
}

/**
 * Every engine topic any registered subject can reach, keyed by engine topic
 * id. Used by the diagram-template registry to check that a newly declared
 * topic has an explicit decision about its diagram.
 */
export function allRegisteredEngineTopics(
  packs: { engineTopics?: Record<string, EngineTopic> }[]
): Map<string, EngineTopic> {
  const topics = new Map<string, EngineTopic>()

  for (const pack of packs) {
    for (const topic of Object.values(pack.engineTopics ?? {})) {
      topics.set(topic.topic, topic)
    }
  }

  return topics
}

/**
 * Map a product display symbol (`v₀`) back to the engine's variable name (`u`).
 * Returns `null` for symbols the topic does not know (e.g. a preset from a
 * non-engine lesson) — callers simply drop unmappable pins.
 */
export function engineNameForDisplaySymbol(
  topic: EngineTopic,
  displaySymbol: string
): string | null {
  for (const [engineName, meta] of Object.entries(topic.variables)) {
    if (meta.symbol === displaySymbol) {
      return engineName
    }
  }
  return null
}

/**
 * Map the product's math-complexity setting to the engine difficulty band.
 * Conceptual difficulty (unit conversion / distractors) is deliberately *not*
 * folded in here: it would introduce numbers the engine never produced and break
 * runtime Data Fidelity, so it stays an LLM phrasing concern for LLM-only
 * lessons.
 */
export function mathComplexityToDifficulty(
  complexity: MathComplexity
): EngineDifficulty {
  switch (complexity) {
    case "integers":
      return "easy"
    case "decimals":
      return "medium"
    case "scientific":
      return "hard"
  }
}

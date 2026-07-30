import { resolveLessonKey } from "@/features/generate/data/generation-presets"
import type { MathComplexity, Subject } from "@/features/generate/types"

import type { EngineDifficulty } from "./client"

/**
 * Which lessons are engine-backed, and how each engine variable is surfaced to a
 * Thai learner (DEVELOPMENT_PLAN §1.2 / §1.3).
 *
 * The symbolic engine names kinematics variables `u, v, a, t, s`; the product
 * surface uses different display symbols (`v₀` for initial velocity) and
 * learner-facing Thai labels. This map is the single translation table so
 * assembled `given_values` / `target_variable` never depend on the LLM for a
 * symbol, label, or unit — only for prose.
 *
 * Adding a Phase 4 topic = adding its lesson id here with its variable metadata;
 * everything downstream (routing, assembly) picks it up automatically.
 */

export type EngineVariableMeta = {
  /** Display symbol shown to students (may differ from the engine's name). */
  symbol: string
  /** Learner-facing Thai label. */
  label: string
  /** Display unit (e.g. `m/s²`, not the engine's ASCII `m/s^2`). */
  unit: string
}

export type EngineTopic = {
  /** The engine `topic` id passed to `POST /generate`. */
  topic: string
  /** Metadata keyed by the engine's variable name (`u, v, a, t, s`). */
  variables: Record<string, EngineVariableMeta>
}

// Exported for the coaching surface (features/coach), which is SUVAT-only in
// v1 and needs the display metadata without going through a lesson id.
export const SUVAT: EngineTopic = {
  topic: "suvat",
  variables: {
    u: { symbol: "v₀", label: "ความเร็วต้น", unit: "m/s" },
    v: { symbol: "v", label: "ความเร็วปลาย", unit: "m/s" },
    a: { symbol: "a", label: "ความเร่ง", unit: "m/s²" },
    t: { symbol: "t", label: "เวลา", unit: "s" },
    s: { symbol: "s", label: "การกระจัด", unit: "m" },
  },
}

/** Lesson id → engine topic. Only lessons listed here go neuro-symbolic. */
const ENGINE_TOPICS_BY_LESSON: Record<string, EngineTopic> = {
  "motion-1d": SUVAT,
}

/**
 * Every engine-backed lesson with its topic, for surfaces that sweep the whole
 * catalog (the prose-fidelity benchmark). Enumerating the map keeps such
 * sweeps in lockstep with what this branch actually wires — a new lesson added
 * above is picked up with no benchmark change.
 */
export function engineBackedLessons(): { lessonId: string; topic: EngineTopic }[] {
  return Object.entries(ENGINE_TOPICS_BY_LESSON).map(([lessonId, topic]) => ({
    lessonId,
    topic,
  }))
}

/**
 * Resolve the engine topic for a lesson, or `null` if the lesson has no engine
 * template yet (those stay on the LLM-only path per §1.3).
 */
export function resolveEngineTopic(
  lesson: string,
  subject: Subject
): EngineTopic | null {
  const { lessonId } = resolveLessonKey(lesson, subject)
  if (!lessonId) return null
  return ENGINE_TOPICS_BY_LESSON[lessonId] ?? null
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
 * lessons (DEVELOPMENT_PLAN §1.2, risk register).
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

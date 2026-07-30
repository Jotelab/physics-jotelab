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

const VECTORS_1D: EngineTopic = {
  topic: "vectors-1d",
  variables: {
    s: { symbol: "s", label: "การกระจัด", unit: "m" },
    t: { symbol: "t", label: "เวลา", unit: "s" },
    v: { symbol: "v", label: "ความเร็ว", unit: "m/s" },
  },
}

const DISTANCE_DISPLACEMENT: EngineTopic = {
  topic: "distance-displacement",
  variables: {
    d1: { symbol: "d₁", label: "การกระจัดช่วงที่ 1", unit: "m" },
    d2: { symbol: "d₂", label: "การกระจัดช่วงที่ 2", unit: "m" },
    disp: { symbol: "s", label: "การกระจัดลัพธ์", unit: "m" },
    dist: { symbol: "d", label: "ระยะทางรวม", unit: "m" },
  },
}

const AVERAGE_SPEED: EngineTopic = {
  topic: "average-speed",
  variables: {
    d1: { symbol: "d₁", label: "การกระจัดช่วงที่ 1", unit: "m" },
    d2: { symbol: "d₂", label: "การกระจัดช่วงที่ 2", unit: "m" },
    t: { symbol: "t", label: "เวลารวม", unit: "s" },
    sp: { symbol: "v̄", label: "อัตราเร็วเฉลี่ย", unit: "m/s" },
    vavg: { symbol: "v̄ₛ", label: "ความเร็วเฉลี่ย", unit: "m/s" },
  },
}

const FREE_FALL: EngineTopic = {
  topic: "free-fall",
  variables: {
    u: { symbol: "v₀", label: "ความเร็วต้น", unit: "m/s" },
    v: { symbol: "v", label: "ความเร็วปลาย", unit: "m/s" },
    t: { symbol: "t", label: "เวลา", unit: "s" },
    h: { symbol: "h", label: "ระยะที่ตกลงมา", unit: "m" },
    g: { symbol: "g", label: "ความเร่งโน้มถ่วง", unit: "m/s²" },
  },
}

const UPWARD_THROW: EngineTopic = {
  topic: "upward-throw",
  variables: {
    u: { symbol: "v₀", label: "ความเร็วต้น", unit: "m/s" },
    v: { symbol: "v", label: "ความเร็วที่เวลา t", unit: "m/s" },
    g: { symbol: "g", label: "ความเร่งโน้มถ่วง", unit: "m/s²" },
    t: { symbol: "t", label: "เวลา", unit: "s" },
    h: { symbol: "h", label: "ความสูง", unit: "m" },
  },
}

// multi-stage-motion and motion-graphs share the same two-phase variables
// (the engine templates share symbols too); only the topic id differs.
const TWO_PHASE_VARIABLES: EngineTopic["variables"] = {
  u: { symbol: "v₀", label: "ความเร็วต้น", unit: "m/s" },
  a: { symbol: "a", label: "ความเร่งช่วงที่ 1", unit: "m/s²" },
  t1: { symbol: "t₁", label: "เวลาช่วงที่ 1", unit: "s" },
  t2: { symbol: "t₂", label: "เวลาช่วงที่ 2", unit: "s" },
  v: { symbol: "v", label: "ความเร็วช่วงคงที่", unit: "m/s" },
  s: { symbol: "s", label: "การกระจัดรวม", unit: "m" },
}

const MULTI_STAGE_MOTION: EngineTopic = {
  topic: "multi-stage-motion",
  variables: TWO_PHASE_VARIABLES,
}

const MOTION_GRAPHS: EngineTopic = {
  topic: "motion-graphs",
  variables: TWO_PHASE_VARIABLES,
}

const RELATIVE_VELOCITY: EngineTopic = {
  topic: "relative-velocity",
  variables: {
    va: { symbol: "vᴬ", label: "ความเร็วของ A", unit: "m/s" },
    vb: { symbol: "vᴮ", label: "ความเร็วของ B", unit: "m/s" },
    vab: { symbol: "vᴬᴮ", label: "ความเร็วของ A เทียบกับ B", unit: "m/s" },
  },
}

const PURSUIT: EngineTopic = {
  topic: "pursuit",
  variables: {
    gap: { symbol: "d₀", label: "ระยะห่างเริ่มต้น", unit: "m" },
    a: { symbol: "a", label: "ความเร่งของคันหน้า", unit: "m/s²" },
    v: { symbol: "v", label: "อัตราเร็วของผู้ไล่", unit: "m/s" },
    t: { symbol: "t", label: "เวลาไล่ทัน", unit: "s" },
  },
}

const TWO_PHASE_ASCENT: EngineTopic = {
  topic: "two-phase-ascent",
  variables: {
    a: { symbol: "a", label: "ความเร่งช่วงเครื่องยนต์ทำงาน", unit: "m/s²" },
    t1: { symbol: "t₁", label: "เวลาช่วงเครื่องยนต์ทำงาน", unit: "s" },
    g: { symbol: "g", label: "ความเร่งโน้มถ่วง", unit: "m/s²" },
    H: { symbol: "H", label: "ความสูงสูงสุด", unit: "m" },
  },
}

/** Lesson id → engine topic. Only lessons listed here go neuro-symbolic. */
const ENGINE_TOPICS_BY_LESSON: Record<string, EngineTopic> = {
  "motion-1d": SUVAT,
  "vectors-1d": VECTORS_1D,
  "distance-displacement": DISTANCE_DISPLACEMENT,
  "average-speed": AVERAGE_SPEED,
  "free-fall": FREE_FALL,
  "upward-throw": UPWARD_THROW,
  "multi-stage-motion": MULTI_STAGE_MOTION,
  "motion-graphs": MOTION_GRAPHS,
  "relative-velocity": RELATIVE_VELOCITY,
  pursuit: PURSUIT,
  "two-phase-ascent": TWO_PHASE_ASCENT,
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

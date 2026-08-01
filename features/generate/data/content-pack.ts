// Subject-agnostic shape of a worksheet-builder content catalog.
//
// Every subject (physics today, more later) registers exactly one
// `SubjectContentPack` in `subject-content-packs.ts`. The generic preset and
// variable-compatibility logic in `generation-presets.ts` /
// `variable-compatibility.ts` reads from the pack for a given subject, so
// adding a subject means authoring a pack — not editing that logic.
//
// That includes which lessons are neuro-symbolic: `engineTopics` below is the
// only place a lesson is bound to an engine topic. `lib/engine/topics.ts` is
// pure resolution logic over these packs and holds no subject data itself.

import type { EngineTopic } from "@/lib/engine/topic-types"

export type ScenarioContent = {
  label: string
  description: string
}

export type VariablePreset = {
  id: string
  symbol: string
  label: string
  unit?: string
  defaultValue?: string | number
}

/** Scenario bucket used for free-text / unknown lessons. */
export const FALLBACK_LESSON_KEY = "fallback"

export type SubjectContentPack = {
  /** Stable lesson ids, in display order. */
  lessonIds: readonly string[]
  /** English display label per lesson id. */
  lessonLabelsEn: Record<string, string>
  /**
   * Scenario rows per lesson id, plus a `FALLBACK_LESSON_KEY` entry used for
   * custom / free-text lessons.
   */
  scenarioContent: Record<string, ScenarioContent[]>
  /** All selectable variable presets for the subject. */
  variablePresets: VariablePreset[]
  /** Variable ids offered for each lesson id. */
  variableIdsByLesson: Record<string, string[]>
  /** find-id → compatible given-ids, per lesson id (drives constraint pruning). */
  givenCandidatesByLessonAndFind: Record<string, Record<string, string[]>>
  /**
   * Lesson id → engine topic, for the lessons that generate neuro-symbolically.
   * Lessons absent here stay on the pure-LLM path.
   *
   * Scoped per subject, so two subjects can each have a `motion-1d` lesson
   * without colliding.
   */
  engineTopics?: Record<string, EngineTopic>
  /** Subject-specific fragments injected into the generation prompts. */
  prompt: SubjectPromptPack
}

export type SubjectPromptPack = {
  /**
   * Noun phrase describing the kind of question, e.g. "calculation question".
   * Used in the prompt framing ("...a high-school {questionKind} for...").
   */
  questionKind: string
  /**
   * Subject-specific generation rule lines (newline-separated, each `- …`),
   * appended after the shared cross-subject rules. Keep these focused on what
   * makes the subject's questions valid (givens, units, formatting).
   */
  generationRules: string
}

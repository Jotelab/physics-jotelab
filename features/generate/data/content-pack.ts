// Subject-agnostic shape of a worksheet-builder content catalog.
//
// Every subject (physics today, more later) registers exactly one
// `SubjectContentPack` in `subject-content-packs.ts`. The generic preset and
// variable-compatibility logic in `generation-presets.ts` /
// `variable-compatibility.ts` reads from the pack for a given subject, so
// adding a subject means authoring a pack — not editing that logic.

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

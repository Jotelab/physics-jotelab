/**
 * Shape of an engine-backed topic.
 *
 * This module is a leaf on purpose: the *types* are engine-domain concepts, but
 * the *data* is subject-specific and lives in each subject's content pack
 * (`features/generate/data/content-packs/*`). Keeping the types here lets
 * `lib/engine` and the packs agree without importing each other in a cycle.
 */

export type EngineVariableMeta = {
  /** Display symbol shown to students (may differ from the engine's name). */
  symbol: string
  /** Learner-facing label, in the product's teaching language. */
  label: string
  /** Display unit (e.g. `m/s²`, not the engine's ASCII `m/s^2`). */
  unit: string
}

export type EngineTopic = {
  /** The engine `topic` id passed to `POST /generate`. */
  topic: string
  /**
   * Metadata keyed by the engine's own variable name (for SUVAT: `u, v, a, t,
   * s`). This is the single translation table between engine names and what a
   * learner sees, so assembled `given_values` / `target_variable` never depend
   * on the LLM for a symbol, label, or unit — only for prose.
   */
  variables: Record<string, EngineVariableMeta>
}

/**
 * TikZ Compilation Rate instrumentation.
 *
 * Every diagram compile attempt — templated now, LLM-generated later — emits one
 * structured line. The Phase 5 benchmark computes the "TikZ Compilation Rate"
 * metric by grep+counting these (`source` splits template vs model, `ok` splits
 * pass vs fail), so the shape is deliberately stable and machine-parseable.
 */

export type TikzDiagramSource = "template" | "llm"

export type TikzCompileAttempt = {
  /** Engine topic the diagram belongs to (e.g. `suvat`). */
  topic: string
  /** Whether the TikZ came from the deterministic template or a model. */
  source: TikzDiagramSource
  /** Did it compile to a usable SVG? */
  ok: boolean
  /** Failure detail when `ok` is false. */
  reason?: string
}

/** Log tag the Phase 5 metric greps for. */
export const TIKZ_COMPILE_LOG_TAG = "[tikz-compile]"

/** The exact line written per attempt (also the unit-test seam). */
export function formatTikzAttempt(attempt: TikzCompileAttempt): string {
  return `${TIKZ_COMPILE_LOG_TAG} ${JSON.stringify({
    metric: "tikz_compilation",
    topic: attempt.topic,
    source: attempt.source,
    ok: attempt.ok,
    ...(attempt.reason ? { reason: attempt.reason } : {}),
  })}`
}

export function logTikzAttempt(attempt: TikzCompileAttempt): void {
  console.info(formatTikzAttempt(attempt))
}

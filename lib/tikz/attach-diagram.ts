import "server-only"

import type { WorksheetQuestion } from "@/features/generate/types"
import type { SympyData } from "@/lib/engine/sympy-data"

import { compileTikz } from "./compile"
import { logTikzAttempt } from "./compilation-log"
import { buildTemplateTikz } from "./templates"

/**
 * Attach a rendered diagram to a question at the display boundary
 * (DEVELOPMENT_PLAN §2.2).
 *
 * The templated diagram is a deterministic function of the engine's `sympy_data`,
 * which is already persisted — so instead of a DB migration for the compiled SVG
 * (it embeds fonts and would blow the question-row size cap), we re-derive the
 * TikZ from `sympy_data` and compile it here, on read. Results are cached by TikZ
 * source, so a given diagram compiles once per process.
 *
 * Best-effort by design: a compile failure logs a benchmark attempt and returns
 * the question with its `tikz_code` but no SVG — the question still renders, just
 * without a picture. Only call this on paths that feed the canvas; internal
 * generation reads (existing-question context) skip it to avoid needless compiles.
 */

const MAX_CACHE_ENTRIES = 256
// Caches the *promise* (not the resolved string) so concurrent requests for the
// same TikZ source share one compile instead of racing past a still-empty cache.
const svgCache = new Map<string, Promise<string>>()

function cacheSet(tikz: string, svg: Promise<string>): void {
  if (svgCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = svgCache.keys().next().value
    if (oldest !== undefined) {
      svgCache.delete(oldest)
    }
  }
  svgCache.set(tikz, svg)
}

/** Test-only: clear the module-level compile cache so specs stay independent. */
export function clearDiagramCacheForTests(): void {
  svgCache.clear()
}

// Each compile spins up a WASM TeX engine (seconds of CPU, tens of MB), so an
// uncapped fan-out over a whole worksheet can exhaust a serverless instance.
const MAX_CONCURRENT_COMPILES = 3
let activeCompiles = 0
const compileQueue: Array<() => void> = []

async function withCompileSlot<T>(work: () => Promise<T>): Promise<T> {
  if (activeCompiles >= MAX_CONCURRENT_COMPILES) {
    await new Promise<void>((resolve) => compileQueue.push(resolve))
  }
  activeCompiles += 1
  try {
    return await work()
  } finally {
    activeCompiles -= 1
    compileQueue.shift()?.()
  }
}

/**
 * One shared compile per TikZ source: cache hit returns the in-flight/settled
 * promise; a miss compiles under the concurrency cap and logs the benchmark
 * attempt (§2.3) exactly once. Failed compiles are evicted so a later read can
 * retry.
 */
function compileCached(
  topic: string,
  tikz: string,
  compile: (code: string) => Promise<string>
): Promise<string> {
  const cached = svgCache.get(tikz)
  if (cached) {
    return cached
  }

  const pending = withCompileSlot(() => compile(tikz)).then(
    (svg) => {
      logTikzAttempt({ topic, source: "template", ok: true })
      return svg
    },
    (error: unknown) => {
      svgCache.delete(tikz)
      logTikzAttempt({
        topic,
        source: "template",
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  )
  cacheSet(tikz, pending)
  return pending
}

export type AttachDiagramDeps = {
  /** Override the compiler (tests inject a fake to avoid the WASM TeX engine). */
  compile?: (tikz: string) => Promise<string>
}

export async function attachQuestionDiagram(
  question: WorksheetQuestion,
  deps: AttachDiagramDeps = {}
): Promise<WorksheetQuestion> {
  // Nothing to do if it already has a diagram or carries no engine payload.
  if (question.diagram_svg || !question.sympy_data) {
    return question
  }

  // E2E stub mode: skip the TeX engine so Playwright CI stays fast and green.
  if (process.env.E2E_STUB_GENERATION === "true") {
    return question
  }

  const tikz = buildTemplateTikz(question.sympy_data)
  if (!tikz) {
    return question
  }

  const topic = question.sympy_data.topic
  const compile = deps.compile ?? ((code: string) => compileTikz(code))

  try {
    const svg = await compileCached(topic, tikz, compile)
    return { ...question, tikz_code: tikz, diagram_svg: svg }
  } catch {
    // Already logged by compileCached; keep the source for traceability and
    // render without a picture.
    return { ...question, tikz_code: tikz }
  }
}

/**
 * Compile the templated diagram for a bare `sympy_data` payload — the coach
 * surface's variant of attach (C1): no `WorksheetQuestion` wrapper, and no
 * E2E-stub skip. The coached problem is a single fixed payload in stub mode, so
 * the one compile lands in the shared cache and every later solve (and
 * Playwright visit) reuses it — this is also the only diagram path that works
 * in the zero-service local clone. Best-effort like attach: `null` means "no
 * template for this topic" or "compile failed"; the solve renders without a
 * picture.
 */
export async function templateDiagramSvg(
  sympyData: SympyData,
  deps: AttachDiagramDeps = {}
): Promise<string | null> {
  const tikz = buildTemplateTikz(sympyData)
  if (!tikz) {
    return null
  }

  const compile = deps.compile ?? ((code: string) => compileTikz(code))

  try {
    return await compileCached(sympyData.topic, tikz, compile)
  } catch {
    // Already logged by compileCached.
    return null
  }
}

/**
 * Inverse of attach, for writes: `tikz_code`/`diagram_svg` are read-time
 * derivations of `sympy_data`, and the DB question allowlist
 * (`is_valid_worksheet_question`) rejects both keys — so any question object
 * heading back into an RPC must shed them. They re-attach on the next read.
 */
export function stripQuestionDiagram<
  T extends { tikz_code?: string; diagram_svg?: string },
>(question: T): Omit<T, "tikz_code" | "diagram_svg"> {
  const rest = { ...question }
  delete rest.tikz_code
  delete rest.diagram_svg
  return rest
}

/** Attach diagrams to a list of questions in parallel (compiles are cached). */
export async function attachQuestionDiagrams(
  questions: WorksheetQuestion[],
  deps: AttachDiagramDeps = {}
): Promise<WorksheetQuestion[]> {
  return Promise.all(questions.map((question) => attachQuestionDiagram(question, deps)))
}

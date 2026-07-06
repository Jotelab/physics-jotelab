import "server-only"

import type { WorksheetQuestion } from "@/features/generate/types"

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
const svgCache = new Map<string, string>()

function cacheGet(tikz: string): string | undefined {
  return svgCache.get(tikz)
}

function cacheSet(tikz: string, svg: string): void {
  if (svgCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = svgCache.keys().next().value
    if (oldest !== undefined) {
      svgCache.delete(oldest)
    }
  }
  svgCache.set(tikz, svg)
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

  const cached = cacheGet(tikz)
  if (cached) {
    return { ...question, tikz_code: tikz, diagram_svg: cached }
  }

  const compile = deps.compile ?? ((code: string) => compileTikz(code))

  try {
    const svg = await compile(tikz)
    cacheSet(tikz, svg)
    logTikzAttempt({ topic, source: "template", ok: true })
    return { ...question, tikz_code: tikz, diagram_svg: svg }
  } catch (error) {
    logTikzAttempt({
      topic,
      source: "template",
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    })
    // Keep the source for traceability; render without a picture.
    return { ...question, tikz_code: tikz }
  }
}

/** Attach diagrams to a list of questions in parallel (compiles are cached). */
export async function attachQuestionDiagrams(
  questions: WorksheetQuestion[],
  deps: AttachDiagramDeps = {}
): Promise<WorksheetQuestion[]> {
  return Promise.all(questions.map((question) => attachQuestionDiagram(question, deps)))
}

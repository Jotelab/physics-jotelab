import "server-only"

import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import { MAX_DIAGRAM_SVG_LEN, MAX_TIKZ_CODE_LEN } from "@/features/generate/limits"

import { embedTikzFonts, type FontLoader } from "./embed-fonts"
import { sanitizeSvg } from "./sanitize-svg"
import { wrapTikzDocument } from "./wrap-document"

/**
 * Server-side TikZ → SVG compiler (ADR-006).
 *
 * We compile TikZ to SVG on the server with node-tikzjax (a WASM TeX engine),
 * embed the referenced TeX fonts so the result is fully self-contained, and
 * sanitize it. The output is a deterministic vector SVG that the A4 canvas can
 * paginate and print without any render-time network access.
 *
 * The heavy TeX engine is loaded lazily (dynamic import) so importing this
 * module — or unit-testing the orchestration with an injected `compile` — never
 * pulls the WASM. Runs only in the Node runtime.
 */

/** Thrown for any failure turning TikZ source into a usable SVG. */
export class TikzCompileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TikzCompileError"
  }
}

/** Compiles a full TeX document (body incl. `\begin{document}`) to an SVG string. */
type TexCompiler = (texDocument: string) => Promise<string>

export type CompileTikzOptions = {
  /** Override the TeX compiler (tests inject a fake to avoid the WASM engine). */
  compile?: TexCompiler
  /** Override how TeX font bytes are resolved (defaults to node-tikzjax's fonts). */
  loadFont?: FontLoader
}

/**
 * Compile one TikZ snippet to a self-contained, sanitized SVG string.
 *
 * @throws {TikzCompileError} on empty input, over-length input, a TeX engine
 * failure, or output that isn't usable SVG. Callers fail closed (fall back to a
 * template or drop the diagram) rather than showing a broken image.
 */
export async function compileTikz(
  tikzCode: string,
  options: CompileTikzOptions = {}
): Promise<string> {
  const source = typeof tikzCode === "string" ? tikzCode.trim() : ""
  if (!source) {
    throw new TikzCompileError("TikZ source is empty.")
  }
  if (source.length > MAX_TIKZ_CODE_LEN) {
    throw new TikzCompileError(
      `TikZ source exceeds ${MAX_TIKZ_CODE_LEN} characters.`
    )
  }

  const compile = options.compile ?? defaultTexCompiler
  const loadFont = options.loadFont ?? defaultFontLoader

  const texDocument = wrapTikzDocument(source)

  let raw: string
  try {
    raw = await compile(texDocument)
  } catch (error) {
    throw new TikzCompileError(
      `TeX engine failed to render the TikZ diagram: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }

  const embedded = embedTikzFonts(raw, loadFont)
  const svg = sanitizeSvg(embedded)

  if (!svg) {
    throw new TikzCompileError("TikZ compiled to empty or invalid SVG.")
  }
  if (svg.length > MAX_DIAGRAM_SVG_LEN) {
    throw new TikzCompileError(
      `Compiled diagram SVG exceeds ${MAX_DIAGRAM_SVG_LEN} characters.`
    )
  }

  return svg
}

const defaultTexCompiler: TexCompiler = async (texDocument) => {
  const { default: tex2svg } = await import("node-tikzjax")
  return tex2svg(texDocument, { showConsole: false })
}

const require = createRequire(import.meta.url)

let cachedFontDir: string | null | undefined

/** Directory holding node-tikzjax's bundled Computer Modern TTFs. */
function resolveFontDir(): string | null {
  if (cachedFontDir !== undefined) {
    return cachedFontDir
  }

  try {
    const pkg = require.resolve("node-tikzjax/package.json")
    cachedFontDir = path.join(path.dirname(pkg), "css", "bakoma", "ttf")
  } catch {
    cachedFontDir = null
  }

  return cachedFontDir
}

const defaultFontLoader: FontLoader = (family) => {
  // Family names are TeX font ids (e.g. `cmmi10`); reject anything else so a
  // crafted family can't escape the font directory via path traversal.
  if (!/^[A-Za-z0-9]+$/.test(family)) {
    return null
  }

  const dir = resolveFontDir()
  if (!dir) {
    return null
  }

  try {
    return fs.readFileSync(path.join(dir, `${family}.ttf`))
  } catch {
    return null
  }
}

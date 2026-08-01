/**
 * Wrap raw TikZ source into the document body node-tikzjax expects.
 *
 * node-tikzjax supplies the `\documentclass` + TikZ preamble internally, but the
 * TeX engine still needs a `\begin{document}...\end{document}` around the body —
 * without it the compile fails with "Missing \begin{document}". Authors (and the
 * Phase 2.2 generator) provide only the `tikzpicture`; this adds the wrapper.
 */
export function wrapTikzDocument(tikzCode: string): string {
  const body = tikzCode.trim()

  // Already a full document (author wrapped it, or we're re-compiling stored
  // source) — don't double-wrap.
  if (/\\begin\s*\{\s*document\s*\}/.test(body)) {
    return body
  }

  return `\\begin{document}\n${body}\n\\end{document}`
}

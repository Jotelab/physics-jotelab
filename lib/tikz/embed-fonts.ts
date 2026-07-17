/**
 * Make a compiled TikZ SVG self-contained by inlining the TeX fonts it uses
 * (DEVELOPMENT_PLAN §2.1).
 *
 * node-tikzjax renders glyphs as `<text>` elements tagged with the Computer
 * Modern family they need (`cmr10`, `cmmi10`, …) and, by default, references
 * those fonts through an `@import` of a CDN stylesheet. A CDN dependency at
 * *render* time is unacceptable: the worksheet must display and print offline
 * (demo-day robustness, risk register). So we base64-embed exactly the families
 * the SVG references as `@font-face` rules inside the SVG itself — no runtime
 * fetches, and it prints as crisp vector at any zoom.
 *
 * The functions here are pure (font bytes come in via {@link FontLoader}) so they
 * unit-test without touching the filesystem; the server compiler wires the real
 * loader in `compile.ts`.
 */

/** Resolve a TeX font family name (e.g. `"cmmi10"`) to its raw TTF bytes. */
export type FontLoader = (family: string) => Uint8Array | null

/** Distinct `font-family` names referenced by `<text>`/attributes in the SVG. */
export function collectFontFamilies(svg: string): string[] {
  const families = new Set<string>()

  for (const match of svg.matchAll(/font-family\s*=\s*"([^"]+)"/gi)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().replace(/^['"]|['"]$/g, "")
      if (name) {
        families.add(name)
      }
    }
  }

  return [...families]
}

/** Build a `<style>` of `@font-face` rules with base64-embedded TTFs. */
export function buildFontFaceStyle(families: string[], loadFont: FontLoader): string {
  const faces: string[] = []

  for (const family of families) {
    const bytes = loadFont(family)
    if (!bytes || bytes.length === 0) {
      continue
    }

    const base64 = Buffer.from(bytes).toString("base64")
    faces.push(
      `@font-face{font-family:'${family}';` +
        `src:url(data:font/ttf;base64,${base64}) format('truetype');` +
        `font-display:block;}`
    )
  }

  if (faces.length === 0) {
    return ""
  }

  return `<style type="text/css">${faces.join("")}</style>`
}

/**
 * Return `svg` with a self-contained font `<style>` inserted just after the
 * opening `<svg …>` tag. Families the loader can't resolve are skipped; if none
 * resolve (or the SVG has no `<svg>` tag) the input is returned unchanged.
 */
export function embedTikzFonts(svg: string, loadFont: FontLoader): string {
  const families = collectFontFamilies(svg)
  if (families.length === 0) {
    return svg
  }

  const style = buildFontFaceStyle(families, loadFont)
  if (!style) {
    return svg
  }

  const openTag = svg.match(/<svg\b[^>]*>/i)
  if (!openTag) {
    return svg
  }

  const insertAt = openTag.index! + openTag[0].length
  return svg.slice(0, insertAt) + style + svg.slice(insertAt)
}

/**
 * Conservative SVG sanitizer for compiled TikZ diagrams.
 *
 * The diagram SVG is injected into the A4 canvas via `dangerouslySetInnerHTML`,
 * so anything active in it would run in the app's origin. The source is our own
 * server-side compiler (node-tikzjax already runs the output through JSDOM +
 * SVGO), but `diagram_svg` can also arrive from stored data, so we strip active
 * content again at the render boundary — defense in depth, and it also removes
 * the CDN font `@import` node-tikzjax would otherwise inline (we embed fonts
 * ourselves; see `embed-fonts.ts`).
 *
 * This is a deliberately narrow allowlist-by-removal on trusted-ish, well-formed
 * compiler output — not a general-purpose HTML sanitizer for arbitrary input.
 */
export function sanitizeSvg(svg: string): string {
  if (typeof svg !== "string") {
    return ""
  }

  let out = svg

  // Drop any leading XML prolog / doctype so the result embeds cleanly inline.
  out = out.replace(/<\?xml[\s\S]*?\?>/gi, "")
  out = out.replace(/<!DOCTYPE[\s\S]*?>/gi, "")

  // Remove executable / HTML-embedding elements entirely (open+content+close,
  // and any self-closing or unclosed stragglers).
  out = out.replace(/<script[\s\S]*?<\/script\s*>/gi, "")
  out = out.replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
  out = out.replace(/<\/?(?:script|foreignObject)\b[^>]*>/gi, "")

  // Strip inline event handlers: on…="…" / on…='…' / on…=bare.
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")

  // Neutralize any external / scripting references in (xlink:)href. Internal
  // fragment refs (`#glyph-id`, used by <use>) and inline data: URIs stay.
  out = out.replace(
    /(\s(?:xlink:)?href\s*=\s*)(["'])(.*?)\2/gi,
    (match, prefix: string, quote: string, value: string) => {
      const trimmed = value.trim()
      if (trimmed.startsWith("#") || /^data:/i.test(trimmed)) {
        return match
      }
      return `${prefix}${quote}${quote}`
    }
  )

  // Remove CSS @import rules (external stylesheet/font fetches at render time).
  out = out.replace(/@import\b[^;]*;/gi, "")

  const svgStart = out.search(/<svg[\s>]/i)
  if (svgStart === -1) {
    return ""
  }

  return out.slice(svgStart).trim()
}

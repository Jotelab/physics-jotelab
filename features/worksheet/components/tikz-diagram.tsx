import { sanitizeSvg } from "@/lib/tikz/sanitize-svg"
import { cn } from "@/lib/utils"

/**
 * Renders a compiled TikZ diagram (a self-contained SVG string) as a vector
 * block in the A4 canvas (DEVELOPMENT_PLAN §2.1).
 *
 * The SVG is injected as-is so it stays vector — it survives `print` and zoom as
 * crisp lines, and carries its own embedded fonts (see `lib/tikz`). We sanitize
 * again here because the markup is injected via `dangerouslySetInnerHTML`; the
 * source is our own compiler, so this is defense in depth, not primary trust.
 *
 * The diagram always sits on a white plate: TeX draws black strokes, which would
 * vanish on the dark-mode card and must read the same on screen and on paper.
 */
export function TikzDiagram({
  svg,
  label,
  className,
}: {
  svg: string
  label?: string
  className?: string
}) {
  const safeSvg = sanitizeSvg(svg)
  if (!safeSvg) {
    return null
  }

  return (
    <figure
      role="img"
      aria-label={label}
      className={cn(
        "tikz-diagram break-inside-avoid overflow-hidden rounded-md border bg-white p-3",
        "flex justify-center text-black",
        "[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full",
        "print:border-0 print:p-0",
        className
      )}
      // Trusted, sanitized compiler output injected as vector SVG (see above).
      dangerouslySetInnerHTML={{ __html: safeSvg }}
    />
  )
}

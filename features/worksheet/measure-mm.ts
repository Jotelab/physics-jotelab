/** Measure a CSS mm length in pixels using the current document (browser A4 sizing). */
export function measureMmToPx(mm: number, doc: Document = document): number {
  const probe = doc.createElement("div")
  probe.style.cssText =
    "position:absolute;left:-9999px;top:0;height:0;width:0;visibility:hidden;pointer-events:none;"
  probe.style.height = `${mm}mm`
  doc.body.appendChild(probe)
  const heightPx = probe.getBoundingClientRect().height
  doc.body.removeChild(probe)
  return heightPx
}

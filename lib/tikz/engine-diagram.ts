/**
 * Serialize the engine's `sympy_data.diagram` payload to TikZ (ported from
 * the jotelab-sandbox testbench).
 *
 * The engine authors the *spec* (templates/diagrams.py: which quantities, which
 * roles, which order); this module only decides geometry. It derives nothing:
 * a label with no `value` is the find target and is drawn as `?` — the
 * answer-hiding rule already happened at the source.
 *
 * Three kinds exist today:
 *   motion-1d  — oriented axis, ordered segments, whole-trip totals
 *   plot-2d    — labelled axes + a polyline (motion-graphs; values ship by design)
 *   actors     — named bodies with velocity arrows (relative-velocity)
 *
 * Labels are TeX math + Latin only (node-tikzjax embeds Computer Modern; Thai
 * would fail to compile), and only plain TikZ is emitted — arrows, nodes,
 * rectangles — because node-tikzjax's default preamble loads no extra
 * libraries.
 */

export type DiagramLabel = {
  symbol: string
  label: string
  role?: "given" | "derived" | "find"
  value?: string | number
  exact?: string
  unit?: string
}

type Motion1dSegment = {
  direction?: "forward" | "reverse"
  velocity_in?: DiagramLabel
  acceleration?: DiagramLabel
  velocity_out?: DiagramLabel
  span?: DiagramLabel
  duration?: DiagramLabel
}

type Motion1dTotal = DiagramLabel & { measures?: string }

type Motion1dSpec = {
  kind: "motion-1d"
  orientation?: "horizontal" | "vertical"
  segments?: Motion1dSegment[]
  totals?: Motion1dTotal[]
}

type PlotAxis = { symbol?: string; unit?: string }

type PlotPoint = { x?: { value?: string | number }; y?: { value?: string | number } }

type Plot2dSpec = {
  kind: "plot-2d"
  axes?: { x?: PlotAxis; y?: PlotAxis }
  points?: PlotPoint[]
}

type ActorsSpec = {
  kind: "actors"
  bodies?: { name?: string; velocity?: DiagramLabel }[]
}

/** `m/s^2` → `\mathrm{m/s^2}`; the odd `·` becomes `\cdot`. */
function unitTex(unit: string | undefined): string {
  if (!unit) return ""
  return `~\\mathrm{${unit.replaceAll("·", "\\cdot ")}}`
}

/** One labelled quantity as TeX math: `v_0 = 12~\mathrm{m/s}`, or `v = ?` for the find. */
function labelTex(item: DiagramLabel): string {
  const name = item.label || item.symbol
  if (item.role === "find" || item.value == null) {
    return `$${name} = \\,?$`
  }
  return `$${name} = ${item.value}${unitTex(item.unit)}$`
}

function isLabel(value: unknown): value is DiagramLabel {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as DiagramLabel).symbol === "string" &&
    typeof (value as DiagramLabel).label === "string"
  )
}

const PICTURE_OPEN = "\\begin{tikzpicture}[>=latex,line join=round]"
const PICTURE_CLOSE = "\\end{tikzpicture}"

function numberOf(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

// ---------------------------------------------------------------------------
// motion-1d, horizontal: segments end to end; reverse legs return below the
// outbound row so an out-and-back path stays legible.
// ---------------------------------------------------------------------------
function horizontalMotion(spec: Motion1dSpec): string {
  const segments = spec.segments ?? []
  const n = Math.max(segments.length, 1)
  const width = n === 1 ? 8 : 9 / n
  const lines: string[] = [PICTURE_OPEN]

  let cursor = 0
  let minX = 0
  let maxX = 0
  const ends: number[] = []

  segments.forEach((segment, index) => {
    const reverse = segment.direction === "reverse"
    const x0 = cursor
    const x1 = reverse ? cursor - width : cursor + width
    cursor = x1
    minX = Math.min(minX, x0, x1)
    maxX = Math.max(maxX, x0, x1)
    ends.push(x1)
    const y = reverse ? -0.75 : 0.45
    const mid = (x0 + x1) / 2

    lines.push(`\\draw[->,very thick] (${x0},${y}) -- (${x1},${y});`)
    if (segment.velocity_in) {
      lines.push(
        `\\node[${reverse ? "below" : "above"}] at (${x0 + (reverse ? -0.7 : 0.7)},${y}) {${labelTex(segment.velocity_in)}};`
      )
    }
    if (segment.velocity_out) {
      lines.push(
        `\\node[${reverse ? "below" : "above"}] at (${x1 + (reverse ? 0.7 : -0.7)},${y}) {${labelTex(segment.velocity_out)}};`
      )
    }
    if (segment.acceleration) {
      const aY = y + 0.9
      lines.push(`\\draw[->,thick] (${mid - 0.7},${aY}) -- (${mid + 0.7},${aY});`)
      lines.push(`\\node[above] at (${mid},${aY}) {${labelTex(segment.acceleration)}};`)
    }
    if (segment.span) {
      const sY = reverse ? y - 0.8 : -0.75 - 0.2 * index
      lines.push(
        `\\draw[<->] (${Math.min(x0, x1)},${sY}) -- (${Math.max(x0, x1)},${sY}) node[midway,below] {${labelTex(segment.span)}};`
      )
    }
    if (segment.duration) {
      lines.push(`\\node[above] at (${mid},${y + (segment.acceleration ? 1.9 : 0.9)}) {${labelTex(segment.duration)}};`)
    }
  })

  // The motion axis under everything the segments drew.
  lines.splice(1, 0, `\\draw[thick] (${minX - 0.5},0) -- (${maxX + 0.5},0);`)
  lines.splice(2, 0, `\\draw[fill=black!8] (${minX - 0.45},-0.28) rectangle (${minX + 0.25},0.28);`)

  let totalY = -1.9
  for (const total of spec.totals ?? []) {
    if (!isLabel(total)) continue
    if (total.measures === "displacement") {
      // Net: start of the first leg to the end of the last. An out-and-back can
      // land on 0; keep a visible stub so the label has an arrow to sit under.
      const end = ends.length ? ends[ends.length - 1] : maxX
      const target = Math.abs(end) < 0.6 ? Math.sign(end || 1) * 0.6 : end
      lines.push(
        `\\draw[->,thick] (0,${totalY}) -- (${target},${totalY}) node[midway,below] {${labelTex(total)}};`
      )
    } else if (total.measures === "path") {
      lines.push(
        `\\draw[<->] (${minX},${totalY}) -- (${maxX},${totalY}) node[midway,below] {${labelTex(total)}};`
      )
    } else {
      // duration / rate: a whole-trip quantity with no geometric extent.
      lines.push(`\\node at (${(minX + maxX) / 2},${totalY - 0.15}) {${labelTex(total)}};`)
    }
    totalY -= 0.95
  }

  lines.push(PICTURE_CLOSE)
  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// motion-1d, vertical. The spec does not carry the gravity direction, so the
// first leg points up exactly when a reverse leg follows (an up-then-back
// figure is a launch); a single forward leg is a fall and points down.
// ---------------------------------------------------------------------------
function verticalMotion(spec: Motion1dSpec): string {
  const segments = spec.segments ?? []
  const hasReverse = segments.some((segment) => segment.direction === "reverse")
  const up = hasReverse
  const height = 3.6
  const lines: string[] = [PICTURE_OPEN]

  // Ground line and the launched/dropped object.
  const groundY = up ? 0 : height
  lines.push(`\\draw[thick] (-1.2,${groundY}) -- (2.4,${groundY});`)
  lines.push(
    `\\draw[fill=black!8] (-0.55,${up ? 0.04 : height - 0.6}) rectangle (0.05,${up ? 0.64 : height - 0.04});`
  )

  segments.forEach((segment, index) => {
    const reverse = segment.direction === "reverse"
    const x = index === 0 ? 0.9 : 2.0
    const goesUp = up !== reverse
    const yStart = goesUp ? 0.1 : height - 0.1
    const yEnd = goesUp ? height - 0.1 : 0.1
    const midY = height / 2

    lines.push(`\\draw[->,very thick] (${x},${yStart}) -- (${x},${yEnd});`)
    if (segment.velocity_in) {
      lines.push(`\\node[right] at (${x + 0.12},${yStart + (goesUp ? 0.45 : -0.45)}) {${labelTex(segment.velocity_in)}};`)
    }
    if (segment.velocity_out) {
      lines.push(`\\node[right] at (${x + 0.12},${yEnd + (goesUp ? -0.45 : 0.45)}) {${labelTex(segment.velocity_out)}};`)
    }
    if (segment.acceleration) {
      // Gravity: always drawn pointing down, off to the left of the figure.
      lines.push(`\\draw[->,thick] (-1.7,${midY + 0.7}) -- (-1.7,${midY - 0.7});`)
      lines.push(`\\node[left] at (-1.8,${midY}) {${labelTex(segment.acceleration)}};`)
    }
    if (segment.span) {
      lines.push(
        `\\draw[<->] (${x + 1.0},0.1) -- (${x + 1.0},${height - 0.1}) node[midway,right] {${labelTex(segment.span)}};`
      )
    }
    if (segment.duration) {
      lines.push(`\\node[below] at (${x},-0.35) {${labelTex(segment.duration)}};`)
    }
  })

  let totalX = 3.6
  for (const total of spec.totals ?? []) {
    if (!isLabel(total)) continue
    if (total.measures === "displacement" || total.measures === "path") {
      lines.push(
        `\\draw[<->] (${totalX},0.1) -- (${totalX},${height - 0.1}) node[midway,right] {${labelTex(total)}};`
      )
      totalX += 2.4
    } else {
      lines.push(`\\node[below] at (0.5,${-0.95}) {${labelTex(total)}};`)
    }
  }

  lines.push(PICTURE_CLOSE)
  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// plot-2d: labelled axes, the polyline, dashed droplines with tick values.
// Every point ships by design (motion-graphs is graph-reading); only an
// annotation naming the find's value would break the rule, and none is drawn.
// ---------------------------------------------------------------------------
function plot2d(spec: Plot2dSpec): string {
  const points = (spec.points ?? [])
    .map((point) => ({ x: numberOf(point.x?.value), y: numberOf(point.y?.value) }))
    .filter((point): point is { x: number; y: number } => point.x !== null && point.y !== null)
  if (points.length === 0) return ""

  const plotW = 7.5
  const plotH = 4
  const maxX = Math.max(...points.map((p) => p.x), 1)
  const maxY = Math.max(...points.map((p) => p.y), 1)
  const sx = (x: number) => (x / maxX) * plotW
  const sy = (y: number) => (y / maxY) * plotH

  const axisLabel = (axis: PlotAxis | undefined) => {
    if (!axis?.symbol) return ""
    const unit = axis.unit ? `~(\\mathrm{${axis.unit.replaceAll("·", "\\cdot ")}})` : ""
    return `$${axis.symbol}${unit}$`
  }

  const lines: string[] = [PICTURE_OPEN]
  lines.push(`\\draw[->] (0,0) -- (${plotW + 0.7},0) node[below] {${axisLabel(spec.axes?.x)}};`)
  lines.push(`\\draw[->] (0,0) -- (0,${plotH + 0.6}) node[left] {${axisLabel(spec.axes?.y)}};`)

  const path = points.map((p) => `(${sx(p.x)},${sy(p.y)})`).join(" -- ")
  lines.push(`\\draw[very thick] ${path};`)

  const seenX = new Set<number>()
  const seenY = new Set<number>()
  for (const point of points) {
    const px = sx(point.x)
    const py = sy(point.y)
    if (point.x > 0 && point.y > 0) {
      lines.push(`\\draw[dashed,thin] (${px},0) -- (${px},${py}) -- (0,${py});`)
    }
    if (point.x > 0 && !seenX.has(point.x)) {
      seenX.add(point.x)
      lines.push(`\\node[below] at (${px},0) {$${point.x}$};`)
    }
    if (point.y > 0 && !seenY.has(point.y)) {
      seenY.add(point.y)
      lines.push(`\\node[left] at (0,${py}) {$${point.y}$};`)
    }
  }
  lines.push(`\\node[below left] at (0,0) {$0$};`)

  lines.push(PICTURE_CLOSE)
  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// actors: named bodies on a shared line, each with a velocity arrow. Negative
// velocity points the arrow the other way; the find gets an arrow with `?`.
// ---------------------------------------------------------------------------
function actors(spec: ActorsSpec): string {
  const bodies = (spec.bodies ?? []).filter((body) => isLabel(body.velocity))
  if (bodies.length === 0) return ""

  const spacing = 4.2
  const lines: string[] = [PICTURE_OPEN]
  lines.push(`\\draw[dashed] (-0.9,0) -- (${(bodies.length - 1) * spacing + 2.6},0);`)

  bodies.forEach((body, index) => {
    const x = index * spacing
    const velocity = body.velocity as DiagramLabel
    const sign = Math.sign(numberOf(velocity.value) ?? 1) || 1
    lines.push(`\\draw[fill=black!8] (${x - 0.45},-0.32) rectangle (${x + 0.45},0.32);`)
    lines.push(`\\node at (${x},0) {$${body.name ?? "?"}$};`)
    lines.push(
      `\\draw[->,very thick] (${x + sign * 0.6},0.75) -- (${x + sign * 2.1},0.75);`
    )
    lines.push(`\\node[above] at (${x + sign * 1.35},0.85) {${labelTex(velocity)}};`)
  })

  lines.push(PICTURE_CLOSE)
  return lines.join("\n")
}

/**
 * Serialize an engine diagram payload to TikZ, or `null` when there is nothing
 * to draw (no payload, an unknown kind, or a spec with no drawable content).
 */
export function engineDiagramTikz(diagram: unknown): string | null {
  if (typeof diagram !== "object" || diagram === null) return null
  const kind = (diagram as { kind?: unknown }).kind
  let tikz = ""
  if (kind === "motion-1d") {
    const spec = diagram as Motion1dSpec
    tikz = spec.orientation === "vertical" ? verticalMotion(spec) : horizontalMotion(spec)
  } else if (kind === "plot-2d") {
    tikz = plot2d(diagram as Plot2dSpec)
  } else if (kind === "actors") {
    tikz = actors(diagram as ActorsSpec)
  }
  return tikz || null
}

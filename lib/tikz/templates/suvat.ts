import type { SympyData } from "@/lib/engine/sympy-data"

/**
 * Deterministic motion-diagram TikZ for a SUVAT (1-D kinematics) instance.
 *
 * This is the "templated, always-compiles" diagram: a pure function of the
 * engine's `sympy_data`, so it needs no model and no persistence (it re-derives
 * from the already-stored payload). It is **variable-consistent** — it draws only
 * the SUVAT quantities the problem actually involves (its Given set plus the Find
 * target) — and labels them with **math symbols only** (`$v_0$`, `$a$`, `$s$`,
 * `$v$`, `$t$`), never values. Symbol-only labels keep the answer hidden and the
 * label set inside node-tikzjax's Latin/math fonts (Thai would not compile).
 *
 * A free-body (force) diagram is not meaningful for pure kinematics; the motion
 * diagram — object, velocity arrows, an acceleration arrow, and displacement /
 * elapsed-time brackets — is the kinematics-appropriate figure. A true free-body
 * diagram arrives with dynamics (F = ma) in Phase 4.
 */

/** Engine variable name → TeX math label used inside the diagram. */
const MATH_LABEL: Record<string, string> = {
  u: "v_0",
  v: "v",
  a: "a",
  t: "t",
  s: "s",
}

export function suvatMotionTikz(sympyData: SympyData): string {
  const active = new Set<string>([
    ...sympyData.given.map((given) => given.symbol),
    sympyData.find.symbol,
  ])

  const has = (symbol: string) => active.has(symbol) && symbol in MATH_LABEL
  const lines: string[] = ["\\begin{tikzpicture}[>=latex,line join=round]"]

  // Ground / motion axis and the object at its starting position.
  lines.push("\\draw[thick] (0,0) -- (9,0);")
  lines.push("\\draw[fill=black!8] (0.6,0) rectangle (1.6,0.9);")

  // Initial velocity (u → v_0) leaving the start object.
  if (has("u")) {
    lines.push(
      "\\draw[->,very thick] (1.8,0.45) -- (3.2,0.45) node[midway,above]{$v_0$};"
    )
  }

  // Acceleration arrow above the path.
  if (has("a")) {
    lines.push(
      "\\draw[->,thick] (3.7,1.2) -- (5.2,1.2) node[midway,above]{$a$};"
    )
  }

  // Final state: a dashed object and the final velocity (v) at the end.
  if (has("v")) {
    lines.push("\\draw[dashed] (6.9,0) rectangle (7.9,0.9);")
    lines.push(
      "\\draw[->,very thick] (8.1,0.45) -- (9.5,0.45) node[midway,above]{$v$};"
    )
  }

  // Elapsed-time bracket across the top (start → final).
  if (has("t")) {
    lines.push(
      "\\draw[<->] (1.1,1.8) -- (7.4,1.8) node[midway,above]{$t$};"
    )
  }

  // Displacement bracket along the bottom.
  if (has("s")) {
    lines.push(
      "\\draw[<->] (0.6,-0.5) -- (7.9,-0.5) node[midway,below]{$s$};"
    )
  }

  lines.push("\\end{tikzpicture}")
  return lines.join("\n")
}

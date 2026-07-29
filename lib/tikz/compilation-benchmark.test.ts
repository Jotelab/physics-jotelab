import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import type { SympyData } from "@/lib/engine/sympy-data"

import { compileTikz } from "./compile"
import { buildTemplateTikz } from "./templates"

/**
 * TikZ Compilation Rate (DEVELOPMENT_PLAN C4) — the templated-diagram half.
 *
 * The SUVAT motion diagram is a pure function of the instance's symbol set
 * (Given ∪ Find), so the five 4-symbol subsets of {u,v,a,t,s} cover every
 * diagram the template can emit. Each is compiled through the **real** TeX
 * engine (node-tikzjax) — no mocks — and the rate is written to
 * benchmarks/results/tikz-compilation-rate.md.
 *
 * Opt-in (real WASM TeX is slow, ~seconds per compile):
 *
 *   TIKZ_BENCHMARK=1 npx vitest run lib/tikz/compilation-benchmark.test.ts
 *
 * The LLM-generated-TikZ half of this metric is on the cut list; per-model
 * rates come from the `[tikz-compile]` production logs (`compilation-log.ts`).
 */

const SPLITS: { given: [string, string, string]; find: string }[] = [
  { given: ["u", "a", "t"], find: "v" },
  { given: ["u", "a", "t"], find: "s" },
  { given: ["u", "a", "s"], find: "v" },
  { given: ["u", "v", "t"], find: "s" },
  { given: ["v", "a", "t"], find: "s" },
]

const UNITS: Record<string, string> = {
  u: "m/s", v: "m/s", a: "m/s^2", t: "s", s: "m",
}

function syntheticSuvat(given: [string, string, string], find: string): SympyData {
  return {
    topic: "suvat",
    seed: 1,
    given: given.map((symbol, index) => ({
      symbol,
      value: index + 2,
      exact: String(index + 2),
      unit: UNITS[symbol],
    })),
    find: { symbol: find, value: 10, exact: "10", unit: UNITS[find] },
    steps: [
      {
        expr_latex: `${find} = \\dots`,
        substituted_latex: `${find} = \\dots`,
        result_latex: `${find} = 10`,
      },
    ],
    final_answer: { value: 10, exact: "10", unit: UNITS[find], latex: "10" },
    policy_applied: "easy",
    plausible: true,
  }
}

describe.skipIf(!process.env.TIKZ_BENCHMARK)("TikZ compilation rate", () => {
  it("compiles every templated SUVAT diagram variant through real TeX", async () => {
    const svgDir = join(process.cwd(), "benchmarks", "results", "tikz")
    mkdirSync(svgDir, { recursive: true })

    const rows: { name: string; ok: boolean; ms: number }[] = []
    for (const split of SPLITS) {
      const data = syntheticSuvat(split.given, split.find)
      const tikz = buildTemplateTikz(data)
      expect(tikz, `${split.given.join(",")}→${split.find}`).toBeTruthy()
      const started = Date.now()
      let ok = false
      try {
        const svg = await compileTikz(tikz!)
        ok = svg.startsWith("<svg")
        if (ok) {
          // Keep the artifact inspectable: the compiled diagram itself is the
          // evidence, not just the pass/fail bit.
          writeFileSync(
            join(svgDir, `suvat-${split.given.join("")}-${split.find}.svg`),
            svg
          )
        }
      } catch {
        ok = false
      }
      rows.push({
        name: `given ${split.given.join(",")} → find ${split.find}`,
        ok,
        ms: Date.now() - started,
      })
    }

    const okCount = rows.filter((row) => row.ok).length
    const lines = [
      "# TikZ Compilation Rate — templated diagrams (DEVELOPMENT_PLAN C4)",
      "",
      "Every distinct SUVAT motion-diagram variant (the template is a pure",
      "function of the Given ∪ Find symbol set), compiled with the real TeX",
      "engine (node-tikzjax), no mocks.",
      "",
      "| diagram variant | compiled | ms |",
      "| --- | --- | ---: |",
      ...rows.map(
        (row) => `| ${row.name} | ${row.ok ? "yes" : "**no**"} | ${row.ms} |`
      ),
      `| **rate** | **${okCount}/${rows.length}** | |`,
      "",
      "LLM-generated TikZ is on the cut list; per-model production rates come",
      "from the `[tikz-compile]` logs (`lib/tikz/compilation-log.ts`).",
      "",
    ]
    const dir = join(process.cwd(), "benchmarks", "results")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "tikz-compilation-rate.md"), lines.join("\n"))

    // ADR-007's claim is "templated diagrams always compile" — hold it to that.
    expect(okCount).toBe(rows.length)
  }, 240_000)
})

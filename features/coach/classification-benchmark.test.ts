import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { runClassificationBenchmark } from "./classification-benchmark"

/**
 * Coaching Effectiveness (a): ≥ 100 scripted wrong-step submissions across the
 * C1.2 error types, classified by the coach's own classifier. Running this file
 * also writes the report table to benchmarks/results/coaching-effectiveness.md.
 */

describe("coaching classification benchmark", () => {
  const report = runClassificationBenchmark()

  it("scripts at least 100 submissions across all six error types", () => {
    expect(report.total).toBeGreaterThanOrEqual(100)
    expect(report.perType).toHaveLength(6)
    expect(report.perType.every((row) => row.total >= 15)).toBe(true)
  })

  it("classifies every canonical scripted error correctly", () => {
    // A miss here is a classifier bug, not benchmark noise: each submission is
    // constructed to be unambiguously its error type.
    for (const row of report.perType) {
      expect(row.correct, row.type).toBe(row.total)
    }
  })

  it("is deterministic (same seed, same table)", () => {
    expect(runClassificationBenchmark().markdown).toBe(report.markdown)
  })

  it("writes the report table for the NSC submission", () => {
    const dir = join(process.cwd(), "benchmarks", "results")
    mkdirSync(dir, { recursive: true })
    const path = join(dir, "coaching-effectiveness.md")
    writeFileSync(path, report.markdown)
    expect(report.markdown).toContain("| **overall** |")
  })
})

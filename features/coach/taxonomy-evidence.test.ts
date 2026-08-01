import { describe, expect, it } from "vitest"

import {
  CATCH_ALL_CEILING,
  MIN_SAMPLE,
  summarizeTaxonomyEvidence,
} from "./taxonomy-evidence"
import type { CoachErrorType } from "./types"

/** `count` copies of one diagnosis. */
function many(errorType: CoachErrorType, count: number): CoachErrorType[] {
  return Array.from({ length: count }, () => errorType)
}

describe("summarizeTaxonomyEvidence", () => {
  it("says nothing from an empty log", () => {
    const evidence = summarizeTaxonomyEvidence([])
    expect(evidence.verdict).toBe("insufficient-data")
    expect(evidence.total).toBe(0)
    expect(evidence.catchAllShare).toBe(0)
  })

  it("refuses to judge below the minimum sample", () => {
    const evidence = summarizeTaxonomyEvidence(many("value-slip", MIN_SAMPLE - 1))
    expect(evidence.hasEnoughData).toBe(false)
    expect(evidence.verdict).toBe("insufficient-data")
  })

  it("calls the taxonomy unsupported when catch-alls dominate", () => {
    // 40 unexplained vs 10 specific — the classifier knows something is wrong
    // but not what, which is exactly the failure this metric exists to catch.
    const evidence = summarizeTaxonomyEvidence([
      ...many("value-slip", 40),
      ...many("sign-error", 10),
    ])
    expect(evidence.catchAllShare).toBeGreaterThan(CATCH_ALL_CEILING)
    expect(evidence.verdict).toBe("unsupported")
  })

  it("calls it supported when most diagnoses are specific", () => {
    const evidence = summarizeTaxonomyEvidence([
      ...many("sign-error", 20),
      ...many("wrong-equation", 15),
      ...many("swapped-variables", 10),
      ...many("value-slip", 5),
    ])
    expect(evidence.verdict).toBe("supported")
    expect(evidence.catchAllShare).toBeLessThan(CATCH_ALL_CEILING)
  })

  it("counts both fallback buckets as catch-alls", () => {
    const evidence = summarizeTaxonomyEvidence([
      ...many("value-slip", 20),
      ...many("arithmetic-slip", 20),
      ...many("sign-error", 10),
    ])
    expect(evidence.catchAllShare).toBeCloseTo(40 / 50)
    expect(evidence.verdict).toBe("unsupported")
  })

  it("ranks the distribution by frequency, stably", () => {
    const evidence = summarizeTaxonomyEvidence([
      ...many("unit-slip", 3),
      ...many("sign-error", 7),
      ...many("wrong-equation", 3),
    ])
    expect(evidence.distribution.map((d) => d.errorType)).toEqual([
      "sign-error",
      // equal counts fall back to alphabetical so the report never reshuffles
      "unit-slip",
      "wrong-equation",
    ])
  })

  it("reports shares that sum to one", () => {
    const evidence = summarizeTaxonomyEvidence([
      ...many("sign-error", 30),
      ...many("unit-slip", 20),
    ])
    const total = evidence.distribution.reduce((sum, d) => sum + d.share, 0)
    expect(total).toBeCloseTo(1)
  })
})

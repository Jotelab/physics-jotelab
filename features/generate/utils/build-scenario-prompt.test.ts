import { describe, expect, it } from "vitest"

import { buildScenarioPrompt } from "./build-scenario-prompt"

describe("buildScenarioPrompt", () => {
  it("returns base scenario when no variables", () => {
    expect(buildScenarioPrompt("Solve for x.")).toBe("Solve for x.")
  })

  it("appends given and target variable sections", () => {
    const result = buildScenarioPrompt("A car accelerates uniformly.", [
      { symbol: "v₀", label: "initial velocity", value: 0, unit: "m/s" },
      { symbol: "t", label: "time", value: 5, unit: "s" },
    ], [{ symbol: "v", label: "final velocity", unit: "m/s" }])

    expect(result).toContain("A car accelerates uniformly.")
    expect(result).toContain("Given: v₀ = 0 m/s (initial velocity), t = 5 s (time).")
    expect(result).toContain("Find: v (final velocity, m/s).")
  })

  it("handles empty given value", () => {
    const result = buildScenarioPrompt("Base.", [{ symbol: "x", label: "unknown", value: "" }])
    expect(result).toContain("Given: x (unknown).")
  })
})

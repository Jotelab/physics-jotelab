import { describe, expect, it } from "vitest"

import { buildScenarioPrompt } from "./build-scenario-prompt"

describe("buildScenarioPrompt", () => {
  it("returns base scenario when no variables", () => {
    expect(buildScenarioPrompt("Solve for x.")).toBe("Solve for x.")
  })

  it("appends given and active target sections", () => {
    const result = buildScenarioPrompt(
      "A car accelerates uniformly.",
      [{ symbol: "v₀", label: "initial velocity", value: 0, unit: "m/s" }],
      { symbol: "v", label: "final velocity", unit: "m/s" }
    )

    expect(result).toContain("A car accelerates uniformly.")
    expect(result).toContain("Given: v₀ = 0 m/s (initial velocity).")
    expect(result).toContain("Find: v (final velocity, m/s).")
  })

  it("includes pool metadata when multiple targets rotate", () => {
    const result = buildScenarioPrompt(
      "Base.",
      undefined,
      { symbol: "v", label: "final velocity", unit: "m/s" },
      {
        pool: [
          { symbol: "v", label: "final velocity", unit: "m/s" },
          { symbol: "a", label: "acceleration", unit: "m/s²" },
        ],
        mode: "rotate",
      }
    )

    expect(result).toContain("Worksheet target pool (rotate across questions)")
    expect(result).toContain("For this question, find v.")
  })

  it("handles empty given value", () => {
    const result = buildScenarioPrompt(
      "Base.",
      [{ symbol: "x", label: "unknown", value: "" }],
      undefined
    )
    expect(result).toContain("Given: x (unknown).")
  })
})

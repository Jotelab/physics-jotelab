import { describe, expect, it } from "vitest"

import { sympyDataSchema } from "./sympy-data"

/**
 * Regression for the sandbox finding: a Zod object strips keys it does not
 * declare, so the engine's `auxiliary` (system-template internal unknowns) and
 * `diagram` (engine-authored figure) payloads were silently dropped at the
 * trust boundary. They must survive parsing.
 */

const base = {
  topic: "suvat",
  seed: 42,
  given: [
    { symbol: "u", value: 0, exact: "0", unit: "m/s" },
    { symbol: "a", value: 2, exact: "2", unit: "m/s^2" },
    { symbol: "t", value: 5, exact: "5", unit: "s" },
  ],
  find: { symbol: "v", value: 10, exact: "10", unit: "m/s" },
  steps: [
    {
      expr_latex: "v = u + a t",
      substituted_latex: "v = 0 + 2 \\cdot 5",
      result_latex: "v = 10\\ \\text{m/s}",
    },
  ],
  final_answer: { value: 10, exact: "10", unit: "m/s", latex: "10\\ \\text{m/s}" },
  policy_applied: "easy",
  plausible: true,
}

describe("sympyDataSchema", () => {
  it("parses a payload without auxiliary/diagram (plain topics)", () => {
    const parsed = sympyDataSchema.parse(base)
    expect(parsed.auxiliary).toBeUndefined()
    expect(parsed.diagram).toBeUndefined()
  })

  it("keeps auxiliary values through parsing (system templates)", () => {
    const parsed = sympyDataSchema.parse({
      ...base,
      topic: "pursuit",
      auxiliary: [{ symbol: "x", value: 20, exact: "20", unit: "m" }],
    })
    expect(parsed.auxiliary).toEqual([
      { symbol: "x", value: 20, exact: "20", unit: "m" },
    ])
  })

  it("keeps the diagram payload through parsing (engine-owned figures)", () => {
    const diagram = {
      kind: "motion-1d",
      segments: [{ from: 0, to: 10 }],
    }
    const parsed = sympyDataSchema.parse({ ...base, diagram })
    expect(parsed.diagram).toEqual(diagram)
  })

  it("rejects a malformed auxiliary entry", () => {
    const result = sympyDataSchema.safeParse({
      ...base,
      auxiliary: [{ symbol: "", value: 20, exact: "20", unit: "m" }],
    })
    expect(result.success).toBe(false)
  })
})

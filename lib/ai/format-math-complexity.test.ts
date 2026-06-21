import { describe, expect, it } from "vitest"

import { formatNumericValue } from "./format-math-complexity"

describe("formatNumericValue", () => {
  it("rounds to integers", () => {
    expect(formatNumericValue(12.7, "integers")).toBe(13)
    expect(formatNumericValue(-2.4, "integers")).toBe(-2)
  })

  it("rounds to up to two decimal places", () => {
    expect(formatNumericValue(12.3456, "decimals")).toBe(12.35)
    expect(formatNumericValue(5, "decimals")).toBe(5)
  })

  it("formats large magnitudes as scientific notation", () => {
    expect(formatNumericValue(320000, "scientific")).toBe("3.2 × 10^5")
  })

  it("formats small magnitudes as scientific notation", () => {
    expect(formatNumericValue(0.0032, "scientific")).toBe("3.2 × 10^-3")
  })

  it("keeps zero as 0 in scientific mode", () => {
    expect(formatNumericValue(0, "scientific")).toBe("0")
  })

  it("keeps moderate values as plain numbers in scientific mode", () => {
    expect(formatNumericValue(42.5, "scientific")).toBe("42.5")
  })

  it("handles negative scientific values", () => {
    expect(formatNumericValue(-4500, "scientific")).toBe("-4.5 × 10^3")
  })

  it("carries mantissa overflow into the exponent", () => {
    expect(formatNumericValue(9999, "scientific")).toBe("1 × 10^4")
    expect(formatNumericValue(-9999, "scientific")).toBe("-1 × 10^4")
  })
})

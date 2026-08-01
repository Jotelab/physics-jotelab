import { describe, expect, it } from "vitest"

import { parseStudentValue } from "./parse-value"

describe("parseStudentValue", () => {
  describe("what the old numeric-only field already accepted", () => {
    it.each([
      ["10", 10],
      ["-9.8", -9.8],
      ["0.5", 0.5],
      ["  12  ", 12],
      ["1,250", 1250],
    ])("parses %s", (input, expected) => {
      expect(parseStudentValue(input)).toBeCloseTo(expected)
    })

    it("rejects empty input as 'not answered yet', not as wrong", () => {
      expect(parseStudentValue("")).toBeNull()
      expect(parseStudentValue("   ")).toBeNull()
    })
  })

  describe("fractions — the engine's own exact form", () => {
    it.each([
      ["1/3", 1 / 3],
      ["21/2", 10.5],
      ["-3/4", -0.75],
      ["1 / 3", 1 / 3],
    ])("parses %s", (input, expected) => {
      expect(parseStudentValue(input)).toBeCloseTo(expected)
    })

    it("returns null for division by zero rather than Infinity", () => {
      expect(parseStudentValue("5/0")).toBeNull()
    })
  })

  describe("arithmetic — students show their working in the box", () => {
    it.each([
      ["20*4", 80],
      ["5 + 2*3", 11],
      ["(5+2)*3", 21],
      ["20*4/2", 40],
      ["2^3", 8],
      ["-(4+1)", -5],
      ["0.5*10^2", 50],
      ["100 - 20 - 30", 50],
    ])("evaluates %s", (input, expected) => {
      expect(parseStudentValue(input)).toBeCloseTo(expected)
    })

    it("respects precedence rather than left-to-right", () => {
      expect(parseStudentValue("2+3*4")).toBe(14)
    })

    it("handles the ×  and ÷ symbols students actually type", () => {
      expect(parseStudentValue("20 × 4")).toBe(80)
      expect(parseStudentValue("80 ÷ 4")).toBe(20)
    })
  })

  describe("units — students type what the label says", () => {
    it.each([
      ["10.5 m/s", 10.5],
      ["9.8 m/s^2", 9.8],
      ["40 เมตร", 40],
      ["5 s", 5],
    ])("ignores the unit in %s", (input, expected) => {
      expect(parseStudentValue(input)).toBeCloseTo(expected)
    })
  })

  describe("Thai digits", () => {
    it("parses Thai numerals", () => {
      expect(parseStudentValue("๑๒")).toBe(12)
      expect(parseStudentValue("๓.๕")).toBeCloseTo(3.5)
    })
  })

  describe("scientific notation", () => {
    it.each([
      ["3e2", 300],
      ["3.2e-2", 0.032],
      ["3 × 10^5", 300000],
    ])("parses %s", (input, expected) => {
      expect(parseStudentValue(input)).toBeCloseTo(expected)
    })
  })

  describe("safety — this evaluates student input, so it must not execute anything", () => {
    it.each([
      "alert(1)",
      "process.exit()",
      "1;2",
      "[].constructor",
      "__proto__",
      "1+",
      "((1)",
      "abc",
      "1/*x*/2",
    ])("returns null for %s rather than evaluating it", (input) => {
      expect(parseStudentValue(input)).toBeNull()
    })

    it("returns null instead of a non-finite number", () => {
      expect(parseStudentValue("1e400")).toBeNull()
    })

    it("refuses absurdly long input rather than parsing it", () => {
      expect(parseStudentValue("1+".repeat(500) + "1")).toBeNull()
    })
  })
})

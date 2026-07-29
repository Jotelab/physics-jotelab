import { describe, expect, it } from "vitest"

import {
  checkAnswer,
  checkEquationChoice,
  checkSubstitution,
  parseStudentNumber,
} from "./classify"

describe("parseStudentNumber", () => {
  it("parses decimals, negatives, and simple fractions", () => {
    expect(parseStudentNumber("2.5")).toBe(2.5)
    expect(parseStudentNumber("-9.8")).toBe(-9.8)
    expect(parseStudentNumber("21/2")).toBe(10.5)
    expect(parseStudentNumber(" -1/3 ")).toBeCloseTo(-1 / 3)
    expect(parseStudentNumber("1,000")).toBe(1000)
  })

  it("returns null for non-numbers and division by zero", () => {
    expect(parseStudentNumber("")).toBeNull()
    expect(parseStudentNumber("abc")).toBeNull()
    expect(parseStudentNumber("1/0")).toBeNull()
  })
})

describe("checkEquationChoice (step ①)", () => {
  it("accepts the oracle relation and classifies anything else", () => {
    expect(checkEquationChoice("v-uat", "v-uat")).toEqual({ ok: true })
    expect(checkEquationChoice("s-uat", "v-uat")).toEqual({
      ok: false,
      errorType: "wrong-equation",
    })
  })
})

describe("checkSubstitution (step ②)", () => {
  const oracle = [
    { symbol: "u", value: 5 },
    { symbol: "a", value: -2 },
    { symbol: "t", value: 3 },
  ]

  it("accepts exact values (within tolerance)", () => {
    expect(
      checkSubstitution(
        [
          { symbol: "u", value: 5 },
          { symbol: "a", value: -2.0000001 },
          { symbol: "t", value: 3 },
        ],
        oracle
      )
    ).toEqual({ ok: true })
  })

  it("classifies u ↔ t transposition as swapped-variables", () => {
    const result = checkSubstitution(
      [
        { symbol: "u", value: 3 },
        { symbol: "a", value: -2 },
        { symbol: "t", value: 5 },
      ],
      oracle
    )
    expect(result).toMatchObject({
      ok: false,
      errorType: "swapped-variables",
      symbols: ["u", "t"],
    })
  })

  it("classifies deceleration entered positive as sign-error", () => {
    const result = checkSubstitution(
      [
        { symbol: "u", value: 5 },
        { symbol: "a", value: 2 },
        { symbol: "t", value: 3 },
      ],
      oracle
    )
    expect(result).toMatchObject({
      ok: false,
      errorType: "sign-error",
      symbols: ["a"],
    })
  })

  it("falls back to value-slip for an unrecognized wrong value", () => {
    const result = checkSubstitution(
      [
        { symbol: "u", value: 7 },
        { symbol: "a", value: -2 },
        { symbol: "t", value: 3 },
      ],
      oracle
    )
    expect(result).toMatchObject({ ok: false, errorType: "value-slip", symbols: ["u"] })
  })

  it("prefers the swapped-pair reading over two independent slips", () => {
    // u ↔ a swapped where both magnitudes differ: a=5 u=-2.
    const result = checkSubstitution(
      [
        { symbol: "u", value: -2 },
        { symbol: "a", value: 5 },
        { symbol: "t", value: 3 },
      ],
      oracle
    )
    expect(result).toMatchObject({ ok: false, errorType: "swapped-variables" })
  })
})

describe("checkAnswer (step ③)", () => {
  it("accepts within tolerance, including a rounded non-terminating answer", () => {
    expect(checkAnswer(10, 10)).toEqual({ ok: true })
    expect(checkAnswer(3.33, 10 / 3)).toEqual({ ok: true })
  })

  it("classifies a flipped sign as sign-error", () => {
    expect(checkAnswer(-10, 10)).toMatchObject({ ok: false, errorType: "sign-error" })
  })

  it("classifies ×3.6 and ×1000 as unit-slip (km/h, prefix slips)", () => {
    expect(checkAnswer(36, 10)).toMatchObject({ ok: false, errorType: "unit-slip" })
    expect(checkAnswer(10_000, 10)).toMatchObject({
      ok: false,
      errorType: "unit-slip",
    })
  })

  it("classifies everything else as arithmetic-slip", () => {
    expect(checkAnswer(12.7, 10)).toMatchObject({
      ok: false,
      errorType: "arithmetic-slip",
    })
  })
})

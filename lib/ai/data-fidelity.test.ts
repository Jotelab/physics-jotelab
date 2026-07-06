import { describe, expect, it } from "vitest"

import type { SympyData } from "@/lib/engine/sympy-data"

import { checkDataFidelity, extractNumbers } from "./data-fidelity"

const SYMPY: SympyData = {
  topic: "suvat",
  seed: 1,
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

describe("extractNumbers", () => {
  it("reads plain integers and decimals", () => {
    expect(extractNumbers("มีความเร่ง 2 m/s² เป็นเวลา 5.5 วินาที")).toEqual([2, 5.5])
  })

  it("reads scientific `×10^` and e-notation", () => {
    expect(extractNumbers("ประจุ 3.2 × 10^5 คูลอมบ์")).toEqual([320000])
    expect(extractNumbers("ค่า 3.2e5")).toEqual([320000])
  })
})

describe("checkDataFidelity", () => {
  it("passes when prose states exactly the givens (0 exempt)", () => {
    const text = "รถเริ่มจากหยุดนิ่ง มีความเร่ง 2 m/s² เป็นเวลา 5 วินาที จงหาความเร็วปลาย"
    expect(checkDataFidelity(text, SYMPY)).toEqual({ ok: true })
  })

  it("flags a leaked answer", () => {
    const text = "มีความเร่ง 2 m/s² เป็นเวลา 5 วินาที ได้ความเร็ว 10 m/s"
    const result = checkDataFidelity(text, SYMPY)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.join(" ")).toContain("answer")
  })

  it("flags a missing given", () => {
    const text = "มีความเร่ง 2 m/s² จงหาความเร็วปลาย"
    const result = checkDataFidelity(text, SYMPY)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.join(" ")).toContain("5")
  })

  it("flags an invented number", () => {
    const text = "มีความเร่ง 2 m/s² เป็นเวลา 5 วินาที และมวล 7 kg"
    const result = checkDataFidelity(text, SYMPY)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.join(" ")).toContain("7")
  })
})

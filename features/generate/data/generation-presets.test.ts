import { describe, expect, it } from "vitest"

import {
  findScenarioById,
  getScenariosForLesson,
  toVariableRows,
} from "./generation-presets"

describe("getScenariosForLesson", () => {
  it("returns exact lesson scenarios when known", () => {
    const { scenarios, isFallback } = getScenariosForLesson("math", "Linear equations")
    expect(isFallback).toBe(false)
    expect(scenarios.length).toBeGreaterThan(0)
    expect(scenarios[0]?.label).toBeTruthy()
  })

  it("returns subject fallback for unknown lessons", () => {
    const { scenarios, isFallback } = getScenariosForLesson("physics", "Unknown topic xyz")
    expect(isFallback).toBe(true)
    expect(scenarios.length).toBeGreaterThan(0)
  })
})

describe("findScenarioById", () => {
  it("finds scenario by id for a lesson", () => {
    const { scenarios } = getScenariosForLesson("math", "Linear equations")
    const first = scenarios[0]
    expect(first).toBeDefined()
    expect(findScenarioById("math", "Linear equations", first!.id)?.id).toBe(first!.id)
  })

  it("returns undefined when lesson changes", () => {
    const { scenarios } = getScenariosForLesson("math", "Linear equations")
    const first = scenarios[0]
    expect(first).toBeDefined()
    expect(findScenarioById("math", "Trigonometry", first!.id)).toBeUndefined()
  })
})

describe("toVariableRows", () => {
  it("maps known variable ids and omits unknown ids", () => {
    const { given, target } = toVariableRows("math", ["math-x", "unknown-id"], "math-y")
    expect(given).toHaveLength(1)
    expect(given[0]?.symbol).toBe("x")
    expect(target).toHaveLength(1)
    expect(target[0]?.symbol).toBe("y")
  })

  it("returns empty target when target id is missing", () => {
    const { target } = toVariableRows("chemistry", [], "")
    expect(target).toEqual([])
  })
})

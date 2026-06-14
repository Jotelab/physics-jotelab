import { describe, expect, it } from "vitest"

import {
  findScenarioById,
  getScenariosForLesson,
  toVariableRows,
} from "./generation-presets"

describe("getScenariosForLesson", () => {
  it("returns exact lesson scenarios when known", () => {
    const { scenarios, isFallback } = getScenariosForLesson("Motion in one dimension")
    expect(isFallback).toBe(false)
    expect(scenarios.length).toBeGreaterThan(0)
    expect(scenarios[0]?.label).toBeTruthy()
  })

  it("returns fallback for unknown lessons", () => {
    const { scenarios, isFallback } = getScenariosForLesson("Unknown topic xyz")
    expect(isFallback).toBe(true)
    expect(scenarios.length).toBeGreaterThan(0)
  })
})

describe("findScenarioById", () => {
  it("finds scenario by id for a lesson", () => {
    const { scenarios } = getScenariosForLesson("Motion in one dimension")
    const first = scenarios[0]
    expect(first).toBeDefined()
    expect(findScenarioById("Motion in one dimension", first!.id)?.id).toBe(first!.id)
  })

  it("returns undefined when lesson changes", () => {
    const { scenarios } = getScenariosForLesson("Motion in one dimension")
    const first = scenarios[0]
    expect(first).toBeDefined()
    expect(findScenarioById("Newton's laws", first!.id)).toBeUndefined()
  })
})

describe("toVariableRows", () => {
  it("maps known variable ids and omits unknown ids", () => {
    const { given, target } = toVariableRows(["phys-v0", "unknown-id"], "phys-v")
    expect(given).toHaveLength(1)
    expect(given[0]?.symbol).toBe("v₀")
    expect(target).toHaveLength(1)
    expect(target[0]?.symbol).toBe("v")
  })

  it("returns empty target when target id is missing", () => {
    const { target } = toVariableRows([], "")
    expect(target).toEqual([])
  })
})

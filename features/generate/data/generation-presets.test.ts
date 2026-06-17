import { describe, expect, it } from "vitest"

import {
  findScenarioById,
  getScenariosForLesson,
  getVariablesForLesson,
  pruneVariableSelection,
  resolveLessonKey,
  toVariableRows,
} from "./generation-presets"

describe("resolveLessonKey", () => {
  it("resolves preset lesson ids", () => {
    expect(resolveLessonKey("motion-1d")).toEqual({
      lessonId: "motion-1d",
      isPreset: true,
      isCustom: false,
    })
  })

  it("resolves legacy English lesson labels", () => {
    expect(resolveLessonKey("Motion in one dimension")).toEqual({
      lessonId: "motion-1d",
      isPreset: true,
      isCustom: false,
    })
  })

  it("treats unknown text as custom", () => {
    expect(resolveLessonKey("Unknown topic xyz")).toEqual({
      lessonId: null,
      isPreset: false,
      isCustom: true,
    })
  })

  it("treats empty input as non-custom", () => {
    expect(resolveLessonKey("   ")).toEqual({
      lessonId: null,
      isPreset: false,
      isCustom: false,
    })
  })
})

describe("getScenariosForLesson", () => {
  it("returns exact lesson scenarios when known by id", () => {
    const { scenarios, isFallback } = getScenariosForLesson("motion-1d")
    expect(isFallback).toBe(false)
    expect(scenarios.length).toBeGreaterThan(0)
    expect(scenarios[0]?.lessonId).toBe("motion-1d")
  })

  it("returns exact lesson scenarios for legacy English labels", () => {
    const { scenarios, isFallback } = getScenariosForLesson("Motion in one dimension")
    expect(isFallback).toBe(false)
    expect(scenarios.length).toBe(4)
  })

  it("returns fallback for unknown lessons", () => {
    const { scenarios, isFallback } = getScenariosForLesson("Unknown topic xyz")
    expect(isFallback).toBe(true)
    expect(scenarios.length).toBeGreaterThan(0)
    expect(scenarios[0]?.lessonId).toBe("fallback")
  })
})

describe("findScenarioById", () => {
  it("finds scenario by id for a lesson", () => {
    const { scenarios } = getScenariosForLesson("motion-1d")
    const first = scenarios[0]
    expect(first).toBeDefined()
    expect(findScenarioById("motion-1d", first!.id)?.id).toBe(first!.id)
  })

  it("returns undefined when lesson changes", () => {
    const { scenarios } = getScenariosForLesson("motion-1d")
    const first = scenarios[0]
    expect(first).toBeDefined()
    expect(findScenarioById("newtons-laws", first!.id)).toBeUndefined()
  })
})

describe("getVariablesForLesson", () => {
  it("returns motion variables for motion-1d", () => {
    const variables = getVariablesForLesson("motion-1d")
    expect(variables.map((variable) => variable.id)).toEqual([
      "phys-v",
      "phys-v0",
      "phys-a",
      "phys-t",
      "phys-s",
    ])
  })

  it("returns all variables for custom lessons", () => {
    const variables = getVariablesForLesson("Custom thermodynamics")
    expect(variables).toHaveLength(12)
  })

  it("returns no variables when lesson is empty", () => {
    expect(getVariablesForLesson("")).toEqual([])
  })
})

describe("pruneVariableSelection", () => {
  it("removes variables outside the lesson scope", () => {
    const pruned = pruneVariableSelection(
      "motion-1d",
      ["phys-v0", "phys-q"],
      "phys-m"
    )
    expect(pruned.givenVariableIds).toEqual(["phys-v0"])
    expect(pruned.targetVariableId).toBe("")
  })

  it("keeps in-scope selections", () => {
    const pruned = pruneVariableSelection("newtons-laws", ["phys-f", "phys-m"], "phys-a")
    expect(pruned.givenVariableIds).toEqual(["phys-f", "phys-m"])
    expect(pruned.targetVariableId).toBe("phys-a")
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

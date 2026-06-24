import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  DEFAULT_CONCEPTUAL_DIFFICULTY,
  DEFAULT_MATH_COMPLEXITY,
} from "@/features/generate/constants/difficulty-settings"
import { getLessonLabel } from "@/features/generate/data/generation-presets"
import { MAX_INITIAL_WORKSHEET_QUESTION_COUNT } from "@/features/generate/limits"

import { buildGenerateWorksheetInput, useWorksheetConfigForm } from "./use-worksheet-config-form"

const baseParams = {
  lesson: "motion-1d",
  scenarioDescription: "Find final velocity given initial velocity, acceleration, and time.",
  resolvedScenarioId: "physics-motion-1d-1",
  effectiveQuestionCount: 10,
  givenVariableIds: [] as string[],
  findVariableIds: [] as string[],
  targetRandomize: false,
  mathComplexity: DEFAULT_MATH_COMPLEXITY,
  conceptualDifficulty: DEFAULT_CONCEPTUAL_DIFFICULTY,
}

describe("buildGenerateWorksheetInput", () => {
  it("resolves preset lesson ids to English labels", () => {
    const result = buildGenerateWorksheetInput(baseParams)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.lesson).toBe(getLessonLabel("motion-1d"))
    expect(result.data.lesson).toBe("Motion in one dimension")
  })

  it("trims custom lesson text", () => {
    const result = buildGenerateWorksheetInput({
      ...baseParams,
      lesson: "  Custom kinematics topic  ",
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.lesson).toBe("Custom kinematics topic")
  })

  it("includes given and target variables when constraints are selected", () => {
    const result = buildGenerateWorksheetInput({
      ...baseParams,
      givenVariableIds: ["phys-v0"],
      findVariableIds: ["phys-v"],
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.given_variables).toEqual([
      expect.objectContaining({
        symbol: "v₀",
        label: "initial velocity",
        value: 0,
        unit: "m/s",
      }),
    ])
    expect(result.data.target_variables).toEqual([
      expect.objectContaining({
        symbol: "v",
        label: "final velocity",
        unit: "m/s",
      }),
    ])
  })

  it("sets target_randomize when the flag is enabled", () => {
    const result = buildGenerateWorksheetInput({
      ...baseParams,
      targetRandomize: true,
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.target_randomize).toBe(true)
  })

  it("rejects invalid question counts", () => {
    expect(buildGenerateWorksheetInput({ ...baseParams, effectiveQuestionCount: 0 }).success).toBe(
      false
    )
    expect(
      buildGenerateWorksheetInput({
        ...baseParams,
        effectiveQuestionCount: MAX_INITIAL_WORKSHEET_QUESTION_COUNT + 1,
      }).success
    ).toBe(false)
  })

  it("uses explicit difficulty values in the payload", () => {
    const result = buildGenerateWorksheetInput({
      ...baseParams,
      mathComplexity: "scientific",
      conceptualDifficulty: "level_3",
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.math_complexity).toBe("scientific")
    expect(result.data.conceptual_difficulty).toBe("level_3")
  })
})

describe("useWorksheetConfigForm", () => {
  it("buildInput uses default difficulty settings from hook state", () => {
    const { result } = renderHook(() => useWorksheetConfigForm())

    act(() => {
      result.current.handleLessonChange("motion-1d")
      result.current.handleScenarioChange(
        "physics-motion-1d-1",
        "Find final velocity given initial velocity, acceleration, and time."
      )
    })

    const parsed = result.current.buildInput(10)

    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    expect(parsed.data.math_complexity).toBe(DEFAULT_MATH_COMPLEXITY)
    expect(parsed.data.conceptual_difficulty).toBe(DEFAULT_CONCEPTUAL_DIFFICULTY)
    expect(parsed.data.question_count).toBe(10)
  })
})

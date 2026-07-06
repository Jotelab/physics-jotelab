import { afterEach, describe, expect, it } from "vitest"

import {
  mathComplexityToDifficulty,
  resolveEngineTopic,
  shouldUseEngine,
} from "./topics"

const ORIGINAL_MODE = process.env.GENERATION_MODE

afterEach(() => {
  if (ORIGINAL_MODE === undefined) delete process.env.GENERATION_MODE
  else process.env.GENERATION_MODE = ORIGINAL_MODE
})

describe("resolveEngineTopic", () => {
  it("maps the kinematics lesson to the SUVAT engine topic", () => {
    expect(resolveEngineTopic("motion-1d", "physics")?.topic).toBe("suvat")
  })

  it("maps the legacy lesson label too", () => {
    expect(resolveEngineTopic("Motion in one dimension", "physics")?.topic).toBe("suvat")
  })

  it("returns null for non-engine lessons and custom text", () => {
    expect(resolveEngineTopic("newtons-laws", "physics")).toBeNull()
    expect(resolveEngineTopic("something custom", "physics")).toBeNull()
  })

  it("surfaces the initial-velocity display symbol/label for SUVAT", () => {
    const topic = resolveEngineTopic("motion-1d", "physics")
    expect(topic?.variables.u).toEqual({
      symbol: "v₀",
      label: "ความเร็วต้น",
      unit: "m/s",
    })
  })
})

describe("shouldUseEngine", () => {
  it("is true for an engine lesson under the default mode", () => {
    delete process.env.GENERATION_MODE
    expect(shouldUseEngine("motion-1d", "physics")).toBe(true)
  })

  it("is false for engine lessons when GENERATION_MODE=llm_only", () => {
    process.env.GENERATION_MODE = "llm_only"
    expect(shouldUseEngine("motion-1d", "physics")).toBe(false)
  })

  it("is false for non-engine lessons regardless of mode", () => {
    process.env.GENERATION_MODE = "neuro_symbolic"
    expect(shouldUseEngine("newtons-laws", "physics")).toBe(false)
  })
})

describe("mathComplexityToDifficulty", () => {
  it("maps math complexity to the engine difficulty band", () => {
    expect(mathComplexityToDifficulty("integers")).toBe("easy")
    expect(mathComplexityToDifficulty("decimals")).toBe("medium")
    expect(mathComplexityToDifficulty("scientific")).toBe("hard")
  })
})

import { afterEach, describe, expect, it } from "vitest"

import { getVariablesForLesson } from "@/features/generate/data/generation-presets"
import { suvatMotionTikz } from "@/lib/tikz/templates/suvat"
import sympyDataContractFixture from "@/tests/fixtures/sympy-data-contract.json"

import { sympyDataSchema, type SympyData } from "./sympy-data"
import {
  engineNameForDisplaySymbol,
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

describe("engineNameForDisplaySymbol", () => {
  const topic = resolveEngineTopic("motion-1d", "physics")!

  it("inverts the display-symbol table (v₀ → u, s → s)", () => {
    expect(engineNameForDisplaySymbol(topic, "v₀")).toBe("u")
    expect(engineNameForDisplaySymbol(topic, "s")).toBe("s")
  })

  it("returns null for symbols the topic does not know", () => {
    expect(engineNameForDisplaySymbol(topic, "F")).toBeNull()
  })
})

// Phase-4 drift guards: the per-variable metadata lives in several tables
// (this registry, the content pack's presets, the TikZ template) and the
// Python contract has a Zod mirror. These cross-checks fail the moment one
// copy is edited without the others.
describe("registry cross-checks", () => {
  const topic = resolveEngineTopic("motion-1d", "physics")!

  it("agrees with the content pack's variable presets on symbol and unit", () => {
    const presets = getVariablesForLesson("motion-1d")

    for (const meta of Object.values(topic.variables)) {
      const preset = presets.find((entry) => entry.symbol === meta.symbol)
      expect(
        preset,
        `content pack has no variable preset for engine symbol ${meta.symbol}`
      ).toBeDefined()
      expect(preset?.unit, `unit drift for ${meta.symbol}`).toBe(meta.unit)
    }
  })

  it("has a TikZ template element for every SUVAT registry variable", () => {
    const base: SympyData = sympyDataSchema.parse(sympyDataContractFixture)

    // Adding a variable to the registry without teaching the template about it
    // must fail here: each active variable has to change the rendered diagram.
    for (const engineName of Object.keys(topic.variables)) {
      const others = Object.keys(topic.variables).filter((name) => name !== engineName)
      const withVariable = suvatMotionTikz({
        ...base,
        given: others.slice(0, 2).map((symbol) => ({ ...base.given[0]!, symbol })),
        find: { ...base.find, symbol: engineName },
      })
      const withoutVariable = suvatMotionTikz({
        ...base,
        given: others.slice(0, 2).map((symbol) => ({ ...base.given[0]!, symbol })),
        find: { ...base.find, symbol: others[2]! },
      })
      expect(
        withVariable,
        `suvatMotionTikz draws nothing for registry variable ${engineName}`
      ).not.toBe(withoutVariable)
    }
  })

  it("parses the engine's checked-in contract fixture with the Zod mirror", () => {
    // The Python repo pins the same payload in
    // jotelab-ai/tests/fixtures/sympy_data_contract.json (test_contract_fixture.py).
    // If this fails, the two repos' contracts drifted — regenerate both fixture
    // copies from the engine and re-align sympyDataSchema.
    const parsed = sympyDataSchema.safeParse(sympyDataContractFixture)
    expect(parsed.success, parsed.success ? "" : parsed.error.message).toBe(true)
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"

import { SUVAT } from "@/lib/engine/topics"

import { generateCoachProblem } from "./actions"
import { buildCoachProblem } from "./oracle"

/**
 * E2E stub mode (C1.3): with E2E_STUB_GENERATION=true a coached solve must run
 * with no engine service configured — the same boundary pattern as
 * `lib/ai/generate-engine-question.ts`.
 */

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("generateCoachProblem under E2E_STUB_GENERATION", () => {
  it("returns a deterministic coachable payload without engine config", async () => {
    vi.stubEnv("E2E_STUB_GENERATION", "true")
    vi.stubEnv("ENGINE_BASE_URL", "")
    vi.stubEnv("ENGINE_API_KEY", "")

    const result = await generateCoachProblem()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.sympyData.topic).toBe("suvat")
    expect(result.sympyData.final_answer.value).toBe(10)
    expect(buildCoachProblem(result.sympyData, SUVAT)).not.toBeNull()
  })

  it("returns the same split for an isomorphic re-roll pin", async () => {
    vi.stubEnv("E2E_STUB_GENERATION", "true")
    vi.stubEnv("ENGINE_BASE_URL", "")
    vi.stubEnv("ENGINE_API_KEY", "")

    const first = await generateCoachProblem()
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const rerolled = await generateCoachProblem({
      given: first.sympyData.given.map((given) => given.symbol),
      find: first.sympyData.find.symbol,
    })

    expect(rerolled.ok).toBe(true)
    if (!rerolled.ok) return
    expect(rerolled.sympyData.given.map((g) => g.symbol)).toEqual(
      first.sympyData.given.map((g) => g.symbol)
    )
    expect(rerolled.sympyData.find.symbol).toBe(first.sympyData.find.symbol)
  })

  it("still reports the engine error when the stub is off", async () => {
    vi.stubEnv("E2E_STUB_GENERATION", "")
    vi.stubEnv("ENGINE_BASE_URL", "")
    vi.stubEnv("ENGINE_API_KEY", "")

    const result = await generateCoachProblem()

    expect(result.ok).toBe(false)
  })
})

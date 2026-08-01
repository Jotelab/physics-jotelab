import { describe, expect, it } from "vitest"

import {
  activeDemoFlags,
  assertNoDemoFlagsInProduction,
  demoModeWarning,
  DemoFlagsInProductionError,
} from "./demo-mode"

const CLEAN = { ENGINE_BASE_URL: "http://127.0.0.1:8000" }

describe("activeDemoFlags", () => {
  it("reports nothing for an engine-backed configuration", () => {
    expect(activeDemoFlags(CLEAN)).toEqual([])
  })

  it.each([
    ["E2E_STUB_GENERATION", "true"],
    ["DEV_PASSWORD_LOGIN", "true"],
  ])("detects %s", (key, value) => {
    const flags = activeDemoFlags({ ...CLEAN, [key]: value })
    expect(flags.map((flag) => flag.key)).toContain(key)
  })

  it("treats GENERATION_MODE=llm_only as a demo flag — it disables the invariant", () => {
    const flags = activeDemoFlags({ ...CLEAN, GENERATION_MODE: "llm_only" })
    expect(flags.map((flag) => flag.key)).toContain("GENERATION_MODE")
  })

  it("does not flag the default neuro_symbolic mode", () => {
    expect(activeDemoFlags({ ...CLEAN, GENERATION_MODE: "neuro_symbolic" })).toEqual([])
  })

  it("ignores flags that are set but not enabled", () => {
    expect(
      activeDemoFlags({ ...CLEAN, DEV_PASSWORD_LOGIN: "false", E2E_STUB_GENERATION: "" })
    ).toEqual([])
  })

  it("reports a missing engine URL so a silent fail-closed run is visible", () => {
    const flags = activeDemoFlags({})
    expect(flags.map((flag) => flag.key)).toContain("ENGINE_BASE_URL")
  })

  it("explains the effect of each flag, not just its name", () => {
    const flags = activeDemoFlags({ ...CLEAN, E2E_STUB_GENERATION: "true" })
    expect(flags[0].effect.length).toBeGreaterThan(20)
  })
})

describe("demoModeWarning", () => {
  it("is null when nothing is stubbed", () => {
    expect(demoModeWarning(CLEAN)).toBeNull()
  })

  it("names every active flag and says the content is not engine-generated", () => {
    const warning = demoModeWarning({
      ...CLEAN,
      DEV_PASSWORD_LOGIN: "true",
      E2E_STUB_GENERATION: "true",
    })
    expect(warning).toContain("DEV_PASSWORD_LOGIN")
    expect(warning).toContain("E2E_STUB_GENERATION")
    expect(warning).toMatch(/NOT engine-generated/i)
  })
})

describe("assertNoDemoFlagsInProduction", () => {
  it("allows a clean production configuration", () => {
    expect(() =>
      assertNoDemoFlagsInProduction({ ...CLEAN, NODE_ENV: "production" })
    ).not.toThrow()
  })

  it("allows stubs outside production — local demos stay possible", () => {
    expect(() =>
      assertNoDemoFlagsInProduction({
        ...CLEAN,
        NODE_ENV: "development",
        E2E_STUB_GENERATION: "true",
      })
    ).not.toThrow()
  })

  it("refuses to build or boot production with curated content enabled", () => {
    expect(() =>
      assertNoDemoFlagsInProduction({
        ...CLEAN,
        NODE_ENV: "production",
        E2E_STUB_GENERATION: "true",
      })
    ).toThrow(DemoFlagsInProductionError)
  })

  it("names the offending flag in the failure", () => {
    expect(() =>
      assertNoDemoFlagsInProduction({
        ...CLEAN,
        NODE_ENV: "production",
        E2E_STUB_GENERATION: "true",
      })
    ).toThrow(/E2E_STUB_GENERATION/)
  })

  it("lets a local build opt out deliberately — the E2E flow needs a stubbed build", () => {
    expect(() =>
      assertNoDemoFlagsInProduction({
        ...CLEAN,
        NODE_ENV: "production",
        E2E_STUB_GENERATION: "true",
        ALLOW_DEMO_FLAGS_IN_BUILD: "true",
      })
    ).not.toThrow()
  })

  it("ignores the opt-out on Vercel, so it can never excuse a real deployment", () => {
    expect(() =>
      assertNoDemoFlagsInProduction({
        ...CLEAN,
        NODE_ENV: "production",
        E2E_STUB_GENERATION: "true",
        ALLOW_DEMO_FLAGS_IN_BUILD: "true",
        VERCEL: "1",
      })
    ).toThrow(DemoFlagsInProductionError)
  })

  it("does not block production merely for an unconfigured engine", () => {
    // Fail-closed at request time is the engine client's job; a missing URL is
    // a deployment gap, not a misrepresentation of content.
    expect(() =>
      assertNoDemoFlagsInProduction({ NODE_ENV: "production" })
    ).not.toThrow()
  })
})

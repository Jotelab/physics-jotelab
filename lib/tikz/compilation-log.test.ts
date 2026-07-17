import { describe, expect, it, vi } from "vitest"

import { formatTikzAttempt, logTikzAttempt, TIKZ_COMPILE_LOG_TAG } from "./compilation-log"

describe("formatTikzAttempt", () => {
  it("emits a stable, parseable line for a successful attempt", () => {
    const line = formatTikzAttempt({ topic: "suvat", source: "template", ok: true })
    expect(line.startsWith(TIKZ_COMPILE_LOG_TAG)).toBe(true)

    const payload = JSON.parse(line.slice(TIKZ_COMPILE_LOG_TAG.length).trim())
    expect(payload).toEqual({
      metric: "tikz_compilation",
      topic: "suvat",
      source: "template",
      ok: true,
    })
  })

  it("includes the reason only on failure", () => {
    const line = formatTikzAttempt({
      topic: "suvat",
      source: "llm",
      ok: false,
      reason: "boom",
    })
    const payload = JSON.parse(line.slice(TIKZ_COMPILE_LOG_TAG.length).trim())
    expect(payload.ok).toBe(false)
    expect(payload.reason).toBe("boom")
  })
})

describe("logTikzAttempt", () => {
  it("writes one formatted line to console.info", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {})
    logTikzAttempt({ topic: "suvat", source: "template", ok: true })
    expect(spy).toHaveBeenCalledWith(
      formatTikzAttempt({ topic: "suvat", source: "template", ok: true })
    )
    spy.mockRestore()
  })
})

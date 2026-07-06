import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EngineError, engineGenerate } from "./client"

const SYMPY = {
  topic: "suvat",
  seed: 1,
  given: [{ symbol: "u", value: 0, exact: "0", unit: "m/s" }],
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

const ORIGINAL = {
  base: process.env.ENGINE_BASE_URL,
  key: process.env.ENGINE_API_KEY,
}

beforeEach(() => {
  process.env.ENGINE_BASE_URL = "http://engine.test/"
  process.env.ENGINE_API_KEY = "secret"
})

afterEach(() => {
  vi.restoreAllMocks()
  process.env.ENGINE_BASE_URL = ORIGINAL.base
  process.env.ENGINE_API_KEY = ORIGINAL.key
})

describe("engineGenerate", () => {
  it("posts to /generate with the api-key header and parses sympy_data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(SYMPY))

    const data = await engineGenerate({ topic: "suvat", difficulty: "easy", seed: 1 })

    expect(data.find.exact).toBe("10")
    const [url, init] = fetchMock.mock.calls[0]
    // trailing slash on the base URL is trimmed
    expect(url).toBe("http://engine.test/generate")
    expect((init?.headers as Record<string, string>)["X-Engine-Api-Key"]).toBe("secret")
    expect(JSON.parse(init?.body as string)).toMatchObject({
      topic: "suvat",
      difficulty: "easy",
      seed: 1,
    })
  })

  it("throws EngineError with the status on a non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ detail: "unsolvable" }, 422)
    )
    await expect(engineGenerate({ topic: "suvat", difficulty: "easy" })).rejects.toMatchObject({
      name: "EngineError",
      status: 422,
    })
  })

  it("throws when the payload does not match the sympy_data contract", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ topic: "suvat" }))
    await expect(engineGenerate({ topic: "suvat", difficulty: "easy" })).rejects.toBeInstanceOf(
      EngineError
    )
  })

  it("throws when the engine is not configured", async () => {
    delete process.env.ENGINE_API_KEY
    await expect(engineGenerate({ topic: "suvat", difficulty: "easy" })).rejects.toBeInstanceOf(
      EngineError
    )
  })
})

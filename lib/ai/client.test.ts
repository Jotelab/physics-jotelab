import { afterEach, describe, expect, it, vi } from "vitest"

import { getGenerationModel } from "./client"

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
  vi.unstubAllEnvs()
})

/**
 * Without a direct API key the model is returned as a Vercel AI Gateway string
 * (`google/<id>`), which makes the resolved model id directly assertable.
 */
function resolvedGatewayModelId(): string {
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const model = getGenerationModel()
  expect(typeof model).toBe("string")
  return (model as string).replace(/^google\//, "")
}

describe("getGenerationModel", () => {
  it("pins a currently-served Gemini model by default", () => {
    delete process.env.MODEL_PROVIDER
    delete process.env.GENERATION_MODEL_ID

    // Retired ids 404 every generation; this must not silently drift back.
    expect(resolvedGatewayModelId()).toBe("gemini-3.5-flash")
  })

  it("lets GENERATION_MODEL_ID override the pinned model without a deploy", () => {
    delete process.env.MODEL_PROVIDER
    process.env.GENERATION_MODEL_ID = "gemini-3.1-flash-lite"

    expect(resolvedGatewayModelId()).toBe("gemini-3.1-flash-lite")
  })

  it("throws for an unknown provider", () => {
    process.env.MODEL_PROVIDER = "not-a-provider"

    expect(() => getGenerationModel()).toThrow(/Unknown MODEL_PROVIDER/)
  })

  it("requires full RunPod configuration", () => {
    process.env.MODEL_PROVIDER = "runpod"
    delete process.env.RUNPOD_BASE_URL
    delete process.env.RUNPOD_API_KEY
    delete process.env.RUNPOD_MODEL_ID

    expect(() => getGenerationModel()).toThrow(/RUNPOD_BASE_URL/)
  })
})

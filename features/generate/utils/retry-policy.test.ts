import { describe, expect, it } from "vitest"

import { shouldRetryGeneration } from "./retry-policy"

describe("shouldRetryGeneration", () => {
  it("retries when code is undefined", () => {
    expect(shouldRetryGeneration(undefined)).toBe(true)
  })

  it("does not retry known terminal codes", () => {
    expect(shouldRetryGeneration("INSUFFICIENT_CREDITS")).toBe(false)
    expect(shouldRetryGeneration("WORKSHEET_ALREADY_COMPLETE")).toBe(false)
    expect(shouldRetryGeneration("NOT_AUTHENTICATED")).toBe(false)
  })

  it("retries transient error codes", () => {
    expect(shouldRetryGeneration("GENERATE_FAILED")).toBe(true)
    expect(shouldRetryGeneration("UNKNOWN")).toBe(true)
  })
})

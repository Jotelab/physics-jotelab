import { APICallError, LoadAPIKeyError, TypeValidationError } from "ai"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  getGenerationErrorMessage,
  getRegenerateErrorMessage,
} from "./generation-errors"

describe("getGenerationErrorMessage", () => {
  it("maps LoadAPIKeyError", () => {
    expect(getGenerationErrorMessage(new LoadAPIKeyError({ message: "missing" }))).toBe(
      "Google AI API key is missing or invalid."
    )
  })

  it("maps APICallError status codes", () => {
    expect(
      getGenerationErrorMessage(
        new APICallError({
          message: "unauthorized",
          statusCode: 401,
          url: "https://example.com",
          requestBodyValues: {},
          responseHeaders: {},
          responseBody: "",
          isRetryable: false,
        })
      )
    ).toBe(
      "Google AI rejected the request. Check your API key and that the Generative Language API is enabled."
    )

    expect(
      getGenerationErrorMessage(
        new APICallError({
          message: "rate limited",
          statusCode: 429,
          url: "https://example.com",
          requestBodyValues: {},
          responseHeaders: {},
          responseBody: "",
          isRetryable: true,
        })
      )
    ).toBe("Google AI rate limit reached. Please wait a moment and try again.")
  })

  it("maps schema validation errors", () => {
    expect(
      getGenerationErrorMessage(
        new TypeValidationError({
          message: "invalid",
          value: {},
          cause: new z.ZodError([]),
        })
      )
    ).toBe("AI returned an invalid question shape. Please try again.")

    expect(getGenerationErrorMessage(new z.ZodError([]))).toBe(
      "AI returned an invalid question shape. Please try again."
    )
  })

  it("uses Error message or fallback", () => {
    expect(getGenerationErrorMessage(new Error("custom"))).toBe("custom")
    expect(getGenerationErrorMessage("oops", "fallback")).toBe("fallback")
  })
})

describe("getRegenerateErrorMessage", () => {
  it("uses regenerate fallback", () => {
    expect(getRegenerateErrorMessage("oops")).toBe(
      "Could not regenerate the question. No credits were spent."
    )
  })
})

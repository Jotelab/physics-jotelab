import { describe, expect, it } from "vitest"

import {
  failure,
  isRetryableCode,
  mapLegacyRpcMessage,
  parseRpcFailure,
  parseStructuredRpcFailure,
} from "./errors"

describe("failure", () => {
  it("uses default messages for known codes", () => {
    expect(failure("INSUFFICIENT_CREDITS")).toEqual({
      ok: false,
      code: "INSUFFICIENT_CREDITS",
      message: "You do not have enough credits.",
    })
  })

  it("allows custom messages", () => {
    expect(failure("VALIDATION_FAILED", "Please complete the worksheet settings.")).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Please complete the worksheet settings.",
    })
  })
})

describe("isRetryableCode", () => {
  it("marks transient codes as retryable", () => {
    expect(isRetryableCode("GENERATE_FAILED")).toBe(true)
    expect(isRetryableCode("UNKNOWN")).toBe(true)
  })

  it("marks business codes as non-retryable", () => {
    expect(isRetryableCode("INSUFFICIENT_CREDITS")).toBe(false)
    expect(isRetryableCode("WORKSHEET_ACCESS_DENIED")).toBe(false)
  })
})

describe("mapLegacyRpcMessage", () => {
  it("maps postgres exception text to codes", () => {
    expect(mapLegacyRpcMessage("Insufficient credits")).toBe("INSUFFICIENT_CREDITS")
    expect(mapLegacyRpcMessage("Worksheet not found or already complete")).toBe(
      "WORKSHEET_ALREADY_COMPLETE"
    )
    expect(mapLegacyRpcMessage("Worksheet or question not found")).toBe("QUESTION_NOT_FOUND")
    expect(mapLegacyRpcMessage("Invalid worksheet question")).toBe("INVALID_QUESTION")
  })
})

describe("parseStructuredRpcFailure", () => {
  it("parses structured RPC failure bodies", () => {
    expect(
      parseStructuredRpcFailure(
        {
          success: false,
          code: "INSUFFICIENT_CREDITS",
          message: "You do not have enough credits.",
        },
        "RESERVE_FAILED"
      )
    ).toEqual(failure("INSUFFICIENT_CREDITS"))
  })

  it("falls back to legacy message mapping when code is missing", () => {
    expect(
      parseStructuredRpcFailure(
        { success: false, message: "Insufficient credits" },
        "RESERVE_FAILED"
      )
    ).toEqual(failure("INSUFFICIENT_CREDITS"))
  })
})

describe("parseRpcFailure", () => {
  it("maps supabase-style errors", () => {
    expect(parseRpcFailure(new Error("Insufficient credits"), "RESERVE_FAILED")).toEqual(
      failure("INSUFFICIENT_CREDITS")
    )
  })

  it("returns fallback when error is empty", () => {
    expect(parseRpcFailure(null, "SAVE_FAILED", "Could not save.")).toEqual(
      failure("SAVE_FAILED", "Could not save.")
    )
  })
})

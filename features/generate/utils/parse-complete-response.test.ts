import { describe, expect, it } from "vitest"

import { failure } from "@/features/generate/errors"
import {
  appendRpcResponse,
  completeFailureRpcResponse,
  validWorksheetQuestion,
} from "@/tests/fixtures/worksheet-question"

import {
  completeResponseWasDbRefunded,
  parseCompleteResponse,
  parseCreditBalance,
} from "./parse-complete-response"

describe("parseCreditBalance", () => {
  it("parses numeric and string balances", () => {
    expect(parseCreditBalance(41)).toBe(41)
    expect(parseCreditBalance("42")).toBe(42)
  })

  it("rejects invalid balances", () => {
    expect(parseCreditBalance("bad")).toBeNull()
    expect(parseCreditBalance(null)).toBeNull()
  })
})

describe("parseCompleteResponse", () => {
  it("parses a successful complete response", () => {
    const result = parseCompleteResponse(appendRpcResponse({ creditBalance: 41 }))

    expect(result).toEqual({
      ok: true,
      data: {
        question: validWorksheetQuestion,
        creditBalance: 41,
      },
    })
  })

  it("parses a DB-side refund failure response", () => {
    const result = parseCompleteResponse(completeFailureRpcResponse({ creditBalance: 42 }))

    expect(result).toEqual({
      ...failure("WORKSHEET_ALREADY_COMPLETE"),
      creditBalance: 42,
    })
  })

  it("rejects invalid complete responses", () => {
    expect(parseCompleteResponse(null)).toEqual(failure("UNKNOWN", "Invalid complete response."))
    expect(parseCompleteResponse({ success: true })).toEqual(
      failure("UNKNOWN", "Invalid complete response.")
    )
  })
})

describe("completeResponseWasDbRefunded", () => {
  it("returns true when the DB reports success=false", () => {
    expect(
      completeResponseWasDbRefunded(
        completeFailureRpcResponse({ message: "Worksheet not found or already complete" })
      )
    ).toBe(true)
  })

  it("returns false for malformed complete responses", () => {
    expect(completeResponseWasDbRefunded({ unexpected: true })).toBe(false)
  })
})

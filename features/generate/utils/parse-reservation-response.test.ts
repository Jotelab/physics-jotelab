import { describe, expect, it } from "vitest"

import {
  pendingQuestionId,
  reservationId,
  reserveAlreadyCompletedResponse,
  reserveRpcResponse,
  validWorksheetQuestion,
} from "@/tests/fixtures/worksheet-question"

import { parseCancelResponse, parseReserveResponse } from "./parse-reservation-response"

describe("parseReserveResponse", () => {
  it("parses a valid reserve response", () => {
    expect(parseReserveResponse(reserveRpcResponse(41))).toEqual({
      kind: "reserved",
      reservationId,
      creditBalance: 41,
      pendingQuestionId,
    })
  })

  it("parses an already-completed reserve response", () => {
    expect(parseReserveResponse(reserveAlreadyCompletedResponse(41))).toEqual({
      kind: "completed",
      question: validWorksheetQuestion,
      creditBalance: 41,
    })
  })

  it("parses a structured reserve failure response", () => {
    expect(
      parseReserveResponse({
        success: false,
        code: "INSUFFICIENT_CREDITS",
        message: "You do not have enough credits.",
        creditBalance: 0,
      })
    ).toEqual({
      kind: "failed",
      code: "INSUFFICIENT_CREDITS",
      message: "You do not have enough credits.",
    })
  })

  it("rejects invalid reserve responses", () => {
    expect(parseReserveResponse(null)).toBeNull()
    expect(parseReserveResponse({ reservationId, creditBalance: "bad" })).toBeNull()
    expect(parseReserveResponse({ alreadyCompleted: true, creditBalance: 41 })).toBeNull()
  })
})

describe("parseCancelResponse", () => {
  it("parses a valid cancel response", () => {
    expect(parseCancelResponse({ creditBalance: 42 })).toBe(42)
  })

  it("rejects invalid cancel responses", () => {
    expect(parseCancelResponse(null)).toBeNull()
    expect(parseCancelResponse({ creditBalance: "bad" })).toBeNull()
  })
})

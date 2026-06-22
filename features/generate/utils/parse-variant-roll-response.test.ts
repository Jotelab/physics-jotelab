import { describe, expect, it } from "vitest"

import { failure } from "@/features/generate/errors"
import {
  reservationId,
  validVariantRoll,
  variantCompleteFailureRpcResponse,
  variantCompleteRpcResponse,
  variantReserveAlreadyCompletedResponse,
  variantReserveRpcResponse,
} from "@/tests/fixtures/worksheet-question"

import {
  parseVariantRollCancelResponse,
  parseVariantRollCompleteResponse,
  parseVariantRollReserveResponse,
} from "./parse-variant-roll-response"

describe("parseVariantRollReserveResponse", () => {
  it("parses a valid reserve response", () => {
    expect(parseVariantRollReserveResponse(variantReserveRpcResponse(41))).toEqual({
      kind: "reserved",
      reservationId,
      creditBalance: 41,
    })
  })

  it("parses an already-completed reserve response", () => {
    expect(parseVariantRollReserveResponse(variantReserveAlreadyCompletedResponse(41))).toEqual({
      kind: "completed",
      roll: validVariantRoll,
      creditBalance: 41,
    })
  })

  it("parses a structured reserve failure response", () => {
    expect(
      parseVariantRollReserveResponse({
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
    expect(parseVariantRollReserveResponse(null)).toBeNull()
    expect(parseVariantRollReserveResponse({ reservationId, creditBalance: "bad" })).toBeNull()
    expect(parseVariantRollReserveResponse({ alreadyCompleted: true, creditBalance: 41 })).toBeNull()
    expect(parseVariantRollReserveResponse({ creditBalance: 41 })).toBeNull()
    expect(parseVariantRollReserveResponse({ reservationId })).toBeNull()
  })
})

describe("parseVariantRollCompleteResponse", () => {
  it("parses a successful complete response", () => {
    const result = parseVariantRollCompleteResponse(variantCompleteRpcResponse({ creditBalance: 41 }))

    expect(result).toEqual({
      ok: true,
      data: {
        roll: validVariantRoll,
        creditBalance: 41,
      },
    })
  })

  it("parses a structured complete failure response", () => {
    const result = parseVariantRollCompleteResponse(
      variantCompleteFailureRpcResponse({ creditBalance: 42 })
    )

    expect(result).toEqual(failure("WORKSHEET_ALREADY_COMPLETE"))
  })

  it("rejects invalid complete responses", () => {
    expect(parseVariantRollCompleteResponse(null)).toEqual(
      failure("SAVE_FAILED", "Invalid complete response.")
    )
    expect(parseVariantRollCompleteResponse({ success: true })).toEqual(
      failure("SAVE_FAILED", "Invalid complete response.")
    )
    expect(
      parseVariantRollCompleteResponse({
        success: true,
        creditBalance: 41,
        roll: { order: 0, given_values: [], solution: { steps: [], final_answer: "" } },
      })
    ).toEqual(failure("SAVE_FAILED", "Invalid complete response."))
  })
})

describe("parseVariantRollCancelResponse", () => {
  it("parses a valid cancel response", () => {
    expect(parseVariantRollCancelResponse({ creditBalance: 42 })).toBe(42)
  })

  it("rejects invalid cancel responses", () => {
    expect(parseVariantRollCancelResponse(null)).toBeNull()
    expect(parseVariantRollCancelResponse({ creditBalance: "bad" })).toBeNull()
    expect(parseVariantRollCancelResponse({})).toBeNull()
  })
})

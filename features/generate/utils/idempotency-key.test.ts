import { describe, expect, it } from "vitest"

import {
  buildGenerateIdempotencyKey,
  buildRegenerateIdempotencyKey,
} from "./idempotency-key"

const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
const questionId = "b1b2c3d4-e5f6-4789-a012-3456789abcde"

describe("idempotency-key", () => {
  it("builds generate keys with worksheet and order", () => {
    expect(buildGenerateIdempotencyKey(worksheetId, 3)).toBe(`gen:${worksheetId}:3`)
  })

  it("builds regenerate keys with worksheet and question id", () => {
    expect(buildRegenerateIdempotencyKey(worksheetId, questionId)).toBe(
      `regen:${worksheetId}:${questionId}`
    )
  })
})

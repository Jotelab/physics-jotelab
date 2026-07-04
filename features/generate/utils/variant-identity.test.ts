import { describe, expect, it } from "vitest"

import { deriveVariantId } from "./variant-identity"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("deriveVariantId", () => {
  const jobId = "11111111-2222-3333-4444-555555555555"

  it("produces a valid RFC 4122 v5 UUID", () => {
    expect(deriveVariantId(jobId, "B")).toMatch(UUID_RE)
  })

  it("is deterministic for the same job + label (stable across replays)", () => {
    expect(deriveVariantId(jobId, "B")).toBe(deriveVariantId(jobId, "B"))
  })

  it("differs by label and by job", () => {
    expect(deriveVariantId(jobId, "B")).not.toBe(deriveVariantId(jobId, "C"))
    expect(deriveVariantId(jobId, "B")).not.toBe(
      deriveVariantId("99999999-2222-3333-4444-555555555555", "B")
    )
  })
})

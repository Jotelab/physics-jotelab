import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockCreateClient, mockLimit } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockLimit: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}))

import { fetchRecentErrorTypes } from "./recent-errors"

/** Minimal stand-in for the chained query builder the function uses. */
function clientReturning(result: unknown) {
  mockLimit.mockResolvedValue(result)
  return {
    from: () => ({
      select: () => ({
        not: () => ({
          order: () => ({ limit: mockLimit }),
        }),
      }),
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("fetchRecentErrorTypes", () => {
  it("returns the student's recent misconceptions", async () => {
    mockCreateClient.mockResolvedValue(
      clientReturning({
        data: [
          { error_type: "sign-error" },
          { error_type: "wrong-equation" },
          { error_type: "sign-error" },
        ],
        error: null,
      })
    )

    await expect(fetchRecentErrorTypes()).resolves.toEqual([
      "sign-error",
      "wrong-equation",
      "sign-error",
    ])
  })

  it("drops null error types — a solved step logs no misconception", async () => {
    mockCreateClient.mockResolvedValue(
      clientReturning({
        data: [{ error_type: "unit-slip" }, { error_type: null }],
        error: null,
      })
    )

    await expect(fetchRecentErrorTypes()).resolves.toEqual(["unit-slip"])
  })

  it("returns empty when the query fails, so /learn still renders", async () => {
    mockCreateClient.mockResolvedValue(
      clientReturning({ data: null, error: { message: "relation does not exist" } })
    )

    await expect(fetchRecentErrorTypes()).resolves.toEqual([])
  })

  it("returns empty when Supabase is unreachable — the coach needs no account", async () => {
    mockCreateClient.mockRejectedValue(new Error("Missing Supabase env"))

    await expect(fetchRecentErrorTypes()).resolves.toEqual([])
  })

  it("returns empty rather than throwing on an empty table", async () => {
    mockCreateClient.mockResolvedValue(clientReturning({ data: [], error: null }))

    await expect(fetchRecentErrorTypes()).resolves.toEqual([])
  })
})

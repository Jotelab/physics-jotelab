import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AttemptRecord } from "./types"

const { mockGetUser, mockRpc, mockCreateClient } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRpc: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}))

import { persistAttempt } from "./persist-attempt"

const RECORD: AttemptRecord = {
  questionKey: "suvat:1:v",
  step: "equation",
  input: "s-uat",
  errorType: "wrong-equation",
  hintsUsed: 1,
  solved: false,
  at: "2026-07-29T12:00:00.000Z",
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateClient.mockResolvedValue({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  })
})

describe("persistAttempt", () => {
  it("records the attempt through the RPC for a signed-in user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "auth-1" } } })
    mockRpc.mockResolvedValue({ data: "row-id", error: null })

    const result = await persistAttempt(RECORD)

    expect(result).toEqual({ persisted: true })
    expect(mockRpc).toHaveBeenCalledWith("record_coaching_attempt", {
      p_question_key: "suvat:1:v",
      p_step: "equation",
      p_input: "s-uat",
      p_error_type: "wrong-equation",
      p_hints_used: 1,
      p_solved: false,
    })
  })

  it("skips persistence for anonymous solves", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await persistAttempt(RECORD)

    expect(result).toEqual({ persisted: false, reason: "anonymous" })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("reports an error result when the RPC fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "auth-1" } } })
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } })

    const result = await persistAttempt(RECORD)

    expect(result).toEqual({ persisted: false, reason: "error" })
  })

  it("degrades gracefully when Supabase is not configured", async () => {
    mockCreateClient.mockRejectedValue(new Error("missing env"))

    const result = await persistAttempt(RECORD)

    expect(result).toEqual({ persisted: false, reason: "error" })
  })
})

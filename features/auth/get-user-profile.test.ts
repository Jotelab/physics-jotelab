import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  // React's `cache` memoizes against the RSC request scope, which a unit test
  // has no access to; identity-wrap it so the loader runs once per call.
  cache: <T>(fn: T) => fn,
}))

const mockRpc = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mockRpc })),
}))

import { getUserProfile } from "./get-user-profile"

// The RPC returns the whole `profiles` row — more than UserProfile declares.
const fullProfileRow = {
  id: "11111111-1111-4111-8111-111111111111",
  auth_user_id: "22222222-2222-4222-8222-222222222222",
  email: "alice@example.com",
  display_name: "Alice",
  avatar_url: null,
  credit_balance: 50,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
}

describe("getUserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the validated profile, stripping non-declared columns", async () => {
    mockRpc.mockResolvedValue({ data: fullProfileRow, error: null })

    const profile = await getUserProfile()

    expect(profile).toEqual({
      display_name: "Alice",
      email: "alice@example.com",
      avatar_url: null,
      credit_balance: 50,
    })
    // DB-only columns must not leak into the server→client payload.
    expect(profile).not.toHaveProperty("id")
    expect(profile).not.toHaveProperty("auth_user_id")
  })

  it("throws when the rpc returns an error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } })

    await expect(getUserProfile()).rejects.toThrow("Could not load user profile")
  })

  it("throws when the rpc payload fails validation", async () => {
    mockRpc.mockResolvedValue({
      data: { email: "alice@example.com", display_name: "Alice", avatar_url: null },
      error: null,
    })

    await expect(getUserProfile()).rejects.toThrow("Could not load user profile")
  })

  it("throws when a field has the wrong type", async () => {
    mockRpc.mockResolvedValue({
      data: { ...fullProfileRow, credit_balance: "50" },
      error: null,
    })

    await expect(getUserProfile()).rejects.toThrow("Could not load user profile")
  })
})

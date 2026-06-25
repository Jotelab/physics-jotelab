import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GET } from "./route"

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}))

function createRequest(url: string) {
  return new NextRequest(url)
}

describe("auth callback route", () => {
  beforeEach(() => {
    createClientMock.mockReset()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("redirects provider errors to login without leaking details in the URL", async () => {
    const response = await GET(
      createRequest(
        "http://localhost:3000/auth/callback?error=server_error&error_description=Unable+to+exchange+external+code%3A+4%2F0A"
      )
    )

    const location = new URL(response.headers.get("location") ?? "")

    expect(location.pathname).toBe("/login")
    expect(location.searchParams.get("error")).toBe("callback")
    expect(location.searchParams.get("error_code")).toBeNull()
    expect(location.searchParams.get("error_description")).toBeNull()
    expect(createClientMock).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith("[auth/callback]", {
      callbackError: "server_error",
      callbackErrorDescription: "Unable to exchange external code: 4/0A",
    })
  })

  it("redirects exchange failures to login without leaking the Supabase error message", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn(async () => ({
          error: { message: "Unable to exchange external code: 4/0A" },
        })),
        signOut: vi.fn(),
      },
      rpc: vi.fn(),
    })

    const response = await GET(
      createRequest("http://localhost:3000/auth/callback?code=test-code")
    )

    const location = new URL(response.headers.get("location") ?? "")

    expect(location.pathname).toBe("/login")
    expect(location.searchParams.get("error")).toBe("callback")
    expect(location.searchParams.get("error_description")).toBeNull()
    expect(console.error).toHaveBeenCalledWith(
      "[auth/callback] exchangeCodeForSession failed",
      "Unable to exchange external code: 4/0A"
    )
  })
})

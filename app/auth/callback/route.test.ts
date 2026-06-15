import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

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
  })

  it("redirects provider errors to login with details", async () => {
    const response = await GET(
      createRequest(
        "http://localhost:3000/auth/callback?error=server_error&error_description=Unable+to+exchange+external+code%3A+4%2F0A"
      )
    )

    const location = new URL(response.headers.get("location") ?? "")

    expect(location.pathname).toBe("/login")
    expect(location.searchParams.get("error")).toBe("callback")
    expect(location.searchParams.get("error_code")).toBe("server_error")
    expect(location.searchParams.get("error_description")).toBe(
      "Unable to exchange external code: 4/0A"
    )
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it("redirects exchange failures to login with the Supabase error message", async () => {
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
    expect(location.searchParams.get("error_description")).toBe(
      "Unable to exchange external code: 4/0A"
    )
  })
})
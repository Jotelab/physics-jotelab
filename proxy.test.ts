// @vitest-environment node

import { NextRequest, NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockUpdateSession = vi.fn()

vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}))

vi.mock("next-intl/middleware", () => ({
  default: () => (request: NextRequest) => NextResponse.next({ request }),
}))

import { proxy } from "./proxy"

const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
const testUser = { id: "user-1" }

function createRequest(pathname: string, origin = "http://localhost:3000") {
  return new NextRequest(new URL(pathname, origin))
}

function mockSession(user: object | null) {
  const response = NextResponse.next()
  mockUpdateSession.mockResolvedValue({ response, user })
  return response
}

function redirectPathname(response: Response) {
  const location = response.headers.get("location")
  expect(location).toBeTruthy()
  return new URL(location!).pathname
}

function expectRedirect(response: Response, pathname: string) {
  expect([307, 308]).toContain(response.status)
  expect(redirectPathname(response)).toBe(pathname)
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("protected routes without user", () => {
    it.each([
      ["/generate"],
      ["/library"],
      [`/library/${worksheetId}`],
      ["/account"],
    ])("redirects %s to /login", async (pathname) => {
      mockSession(null)
      const request = createRequest(pathname)

      const result = await proxy(request)

      expectRedirect(result, "/login")
      expect(mockUpdateSession).toHaveBeenCalledOnce()
      expect(mockUpdateSession).toHaveBeenCalledWith(request)
    })
  })

  describe("login route with authenticated user", () => {
    it("redirects /login to /generate", async () => {
      mockSession(testUser)
      const request = createRequest("/login")

      const result = await proxy(request)

      expectRedirect(result, "/generate")
      expect(mockUpdateSession).toHaveBeenCalledWith(request)
    })
  })

  describe("pass-through", () => {
    it("returns session response for authenticated protected routes", async () => {
      const sessionResponse = mockSession(testUser)
      const request = createRequest("/generate")

      const result = await proxy(request)

      expect(result).toBe(sessionResponse)
      expect(result.status).not.toBe(307)
      expect(result.status).not.toBe(308)
    })

    it("returns session response for unauthenticated /login", async () => {
      const sessionResponse = mockSession(null)
      const request = createRequest("/login")

      const result = await proxy(request)

      expect(result).toBe(sessionResponse)
      expect(result.status).not.toBe(307)
      expect(result.status).not.toBe(308)
    })
  })
})

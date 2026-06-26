import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockSignInWithOAuth, mockSignOut } = vi.hoisted(() => ({
  mockSignInWithOAuth: vi.fn(),
  mockSignOut: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock("@/lib/supabase/get-request-origin", () => ({
  getRequestOrigin: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithOAuth: mockSignInWithOAuth, signOut: mockSignOut },
  })),
}))

import { redirect } from "next/navigation"
import { getRequestOrigin } from "@/lib/supabase/get-request-origin"
import { createClient } from "@/lib/supabase/server"

import { signInWithGoogleAction, signOutAction } from "./actions"

const mockRedirect = vi.mocked(redirect)
const mockOrigin = vi.mocked(getRequestOrigin)
const mockCreateClient = vi.mocked(createClient)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("signInWithGoogleAction", () => {
  it("redirects to the provider url on success", async () => {
    mockOrigin.mockResolvedValue("https://physics-jotelab.vercel.app")
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/auth?xyz" },
      error: null,
    })

    await expect(signInWithGoogleAction()).rejects.toThrow(
      "NEXT_REDIRECT:https://accounts.google.com/o/oauth2/auth?xyz"
    )
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://physics-jotelab.vercel.app/auth/callback" },
    })
    expect(mockRedirect).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/auth?xyz")
  })

  it("redirects to the oauth error page when no allowed origin is resolved", async () => {
    mockOrigin.mockResolvedValue(null)

    await expect(signInWithGoogleAction()).rejects.toThrow("NEXT_REDIRECT:/login?error=oauth")
    expect(mockRedirect).toHaveBeenCalledWith("/login?error=oauth")
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(mockSignInWithOAuth).not.toHaveBeenCalled()
  })

  it("redirects to the oauth error page when the provider returns an error", async () => {
    mockOrigin.mockResolvedValue("http://localhost:3000")
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: "denied" },
    })

    await expect(signInWithGoogleAction()).rejects.toThrow("NEXT_REDIRECT:/login?error=oauth")
    expect(mockRedirect).toHaveBeenCalledWith("/login?error=oauth")
  })

  it("redirects to the oauth error page when the provider returns no url", async () => {
    mockOrigin.mockResolvedValue("http://localhost:3000")
    mockSignInWithOAuth.mockResolvedValue({ data: { url: null }, error: null })

    await expect(signInWithGoogleAction()).rejects.toThrow("NEXT_REDIRECT:/login?error=oauth")
    expect(mockRedirect).toHaveBeenCalledWith("/login?error=oauth")
  })
})

describe("signOutAction", () => {
  it("signs out and redirects to the login page", async () => {
    mockSignOut.mockResolvedValue({ error: null })

    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/login")
    expect(mockSignOut).toHaveBeenCalledOnce()
    expect(mockRedirect).toHaveBeenCalledWith("/login")
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { mockSignInWithPassword, mockCreateClient, mockRedirect } = vi.hoisted(
  () => ({
    mockSignInWithPassword: vi.fn(),
    mockCreateClient: vi.fn(),
    mockRedirect: vi.fn((location: string) => {
      throw new Error(`NEXT_REDIRECT:${location}`)
    }),
  })
)

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}))

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}))

import { devPasswordLoginEnabled } from "./dev-login-enabled"
import { signInWithDevPasswordAction } from "./dev-login"

function formData(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value)
  }
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateClient.mockResolvedValue({
    auth: { signInWithPassword: mockSignInWithPassword },
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("devPasswordLoginEnabled", () => {
  it("is off by default", () => {
    vi.stubEnv("DEV_PASSWORD_LOGIN", "")
    expect(devPasswordLoginEnabled()).toBe(false)
  })

  it("is on only for the exact value true", () => {
    vi.stubEnv("DEV_PASSWORD_LOGIN", "true")
    expect(devPasswordLoginEnabled()).toBe(true)
    vi.stubEnv("DEV_PASSWORD_LOGIN", "1")
    expect(devPasswordLoginEnabled()).toBe(false)
  })
})

describe("signInWithDevPasswordAction", () => {
  it("signs in with the submitted credentials and redirects to /generate", async () => {
    vi.stubEnv("DEV_PASSWORD_LOGIN", "true")
    mockSignInWithPassword.mockResolvedValue({ error: null })

    await expect(
      signInWithDevPasswordAction(
        formData({ email: "e2e@test.jotelab.local", password: "pw" })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/generate")

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "e2e@test.jotelab.local",
      password: "pw",
    })
  })

  it("refuses to run when the flag is off", async () => {
    vi.stubEnv("DEV_PASSWORD_LOGIN", "")

    await expect(
      signInWithDevPasswordAction(formData({ email: "a@b.c", password: "pw" }))
    ).rejects.toThrow("NEXT_REDIRECT:/login")

    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it("redirects back to /login with an error on bad credentials", async () => {
    vi.stubEnv("DEV_PASSWORD_LOGIN", "true")
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    })

    await expect(
      signInWithDevPasswordAction(formData({ email: "a@b.c", password: "nope" }))
    ).rejects.toThrow("NEXT_REDIRECT:/login?error=dev_credentials")
  })

  it("redirects back to /login when fields are missing", async () => {
    vi.stubEnv("DEV_PASSWORD_LOGIN", "true")

    await expect(
      signInWithDevPasswordAction(formData({ email: "a@b.c" }))
    ).rejects.toThrow("NEXT_REDIRECT:/login?error=dev_credentials")

    expect(mockSignInWithPassword).not.toHaveBeenCalled()
  })
})

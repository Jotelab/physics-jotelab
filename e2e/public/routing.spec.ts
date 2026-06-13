import { expect, test } from "@playwright/test"

import { applyTestUserSession } from "../utils/apply-test-user-session"
import { hasAuthenticatedE2E } from "../utils/env"

test.describe("not found", () => {
  test("unknown route shows root not found page", async ({ page }) => {
    await page.goto("/this-route-does-not-exist")
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible()
    await expect(page.getByRole("link", { name: /Go to Generate/i })).toBeVisible()
  })
})

test.describe("login error query params", () => {
  for (const error of ["oauth", "callback", "profile"] as const) {
    test(`login page renders with error=${error}`, async ({ page }) => {
      await page.goto(`/login?error=${error}`)
      await expect(page.getByRole("heading", { name: "PhysicsJotelab" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Login with Google" })).toBeVisible()
      expect(page.url()).toContain(`error=${error}`)
    })
  }
})

test.describe("auth callback errors", () => {
  test("missing code redirects to login with callback error", async ({ page }) => {
    await page.goto("/auth/callback")
    await expect(page).toHaveURL(/\/login\?error=callback/)
    await expect(page.getByRole("heading", { name: "PhysicsJotelab" })).toBeVisible()
  })
})

test.describe("login redirect when authenticated", () => {
  test("redirects /login to /generate when session exists", async ({ page, baseURL }) => {
    test.skip(!hasAuthenticatedE2E, "requires E2E_TEST_USER_* and Supabase env vars")

    await applyTestUserSession(page, baseURL!)
    await page.goto("/login")
    await expect(page).toHaveURL(/\/generate/)
  })
})

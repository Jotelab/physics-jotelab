import { expect, test } from "@playwright/test"

test.describe("auth guards", () => {
  test("protected routes redirect to login", async ({ page }) => {
    await page.goto("/generate")
    await expect(page).toHaveURL(/\/login/)

    await page.goto("/library")
    await expect(page).toHaveURL(/\/login/)

    await page.goto("/account")
    await expect(page).toHaveURL(/\/login/)
  })

  test("login page shows Google sign-in", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: "PhysicsJotelab" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Login with Google" })).toBeVisible()
  })

  test("home redirects through generate to login when unauthenticated", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/login/)
  })
})

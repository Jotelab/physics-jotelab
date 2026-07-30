import { test, expect } from "@playwright/test"

test.describe("authenticated dashboard", () => {
  test("generate page loads builder", async ({ page }) => {
    await page.goto("/generate")
    // "Worksheet Preview" appears twice (header breadcrumb + editable-title
    // button); target the editable title so strict mode stays satisfied.
    await expect(
      page.getByRole("button", { name: "Edit worksheet title" })
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.locator("#lesson-combobox")).toBeVisible()
  })

  test("library page loads", async ({ page }) => {
    await page.goto("/library")
    await expect(page).toHaveURL(/\/library/)
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible()
  })

  test("account page shows credits", async ({ page }) => {
    await page.goto("/account")
    await expect(page).toHaveURL(/\/account/)
    await expect(page.getByText("Credits", { exact: true })).toBeVisible()
  })
})

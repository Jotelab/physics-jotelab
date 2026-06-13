import { expect, test } from "@playwright/test"

test.describe("locale cookie", () => {
  test("shows Thai navigation when NEXT_LOCALE=th", async ({ page, baseURL }) => {
    await page.context().addCookies([
      {
        name: "NEXT_LOCALE",
        value: "th",
        url: baseURL!,
      },
    ])

    await page.goto("/login")
    await expect(page.getByRole("button", { name: "เข้าสู่ระบบด้วย Google" })).toBeVisible()
  })
})

import { expect, test } from "@playwright/test"

test.describe("generate golden path", () => {
  test.describe.configure({ mode: "serial" })

  test("preset selection updates preview and generate fills questions", async ({ page }) => {
    await page.goto("/generate")
    await expect(page.locator("#generate-worksheet-btn")).toBeVisible({ timeout: 15_000 })

    const lessonInput = page.locator("#lesson-combobox")
    await lessonInput.click()
    await lessonInput.fill("Motion in one dimension")
    await page.locator("#lesson-listbox").getByRole("option", { name: "Motion in one dimension" }).click()

    await page.locator("#scenario-select").click()
    await page.locator("#scenario-listbox").getByRole("option", { name: "Find final velocity" }).click()

    await expect(page.getByText("Physics: Motion in one dimension")).toBeVisible()
    await expect(
      page.getByText(/questions - Find final velocity given initial velocity, acceleration, and time/i)
    ).toBeVisible()

    await page.locator("#generate-worksheet-btn").click()

    await expect(page.getByText("จงหาค่า", { exact: false })).toBeVisible({ timeout: 60_000 })
    await expect(page.locator("#regenerate-all-btn")).toBeVisible()
  })
})

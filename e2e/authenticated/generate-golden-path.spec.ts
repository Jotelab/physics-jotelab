import { expect, test } from "@playwright/test"

test.describe("generate golden path", () => {
  test.describe.configure({ mode: "serial" })

  test("preset selection updates preview and generate fills questions", async ({ page }) => {
    await page.goto("/generate")
    await expect(page.locator("#generate-worksheet-btn")).toBeVisible({ timeout: 15_000 })

    await page.getByRole("button", { name: "Select Math" }).click()

    const lessonInput = page.locator("#lesson-combobox")
    await lessonInput.click()
    await lessonInput.fill("Linear equations")
    await page.locator("#lesson-listbox").getByRole("option", { name: "Linear equations" }).click()

    await page.locator("#scenario-select").click()
    await page.locator("#scenario-listbox").getByRole("option", { name: "Solve for x" }).click()

    await expect(page.getByText("Math: Linear equations")).toBeVisible()
    await expect(
      page.getByText(/questions - Solve a linear equation for the unknown variable x/i)
    ).toBeVisible()

    await page.locator("#generate-worksheet-btn").click()

    await expect(page.getByText("จงหาค่า", { exact: false })).toBeVisible({ timeout: 60_000 })
    await expect(page.locator("#regenerate-all-btn")).toBeVisible()
  })
})

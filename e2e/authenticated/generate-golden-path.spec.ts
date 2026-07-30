import { expect, test } from "@playwright/test"

test.describe("generate golden path", () => {
  // Generation (even stubbed) plus the dev-server compile can exceed the 30s
  // default; the timeout must cover the 60s question-visibility expect below.
  test.describe.configure({ mode: "serial", timeout: 90_000 })

  test("preset selection updates preview and generate fills questions", async ({ page }) => {
    await page.goto("/generate")
    await expect(page.locator("#generate-worksheet-btn")).toBeVisible({ timeout: 15_000 })

    const lessonInput = page.locator("#lesson-combobox")
    await lessonInput.click()
    await lessonInput.fill("Motion in one dimension")
    await page.locator("#lesson-listbox").getByRole("option", { name: "Motion in one dimension" }).click()

    await page.locator("#scenario-select").click()
    await page.locator("#scenario-listbox").getByRole("option", { name: "Find final velocity" }).click()

    // The preview title renders twice (header breadcrumb + the editable-title
    // button), so an unscoped text locator trips strict mode.
    await expect(
      page.getByRole("button", { name: "Edit worksheet title" })
    ).toHaveText("Physics: Motion in one dimension")
    await expect(
      page.getByText(/questions - Find final velocity given initial velocity, acceleration, and time/i)
    ).toBeVisible()

    await page.locator("#generate-worksheet-btn").click()

    // Engine-backed lessons stub with the SUVAT fixture (lib/ai/e2e-stub-question.ts),
    // which appears once per generated question — hence .first().
    await expect(
      page.getByText("จงหาความเร็วปลาย", { exact: false }).first()
    ).toBeVisible({ timeout: 60_000 })
    await expect(page.locator("#regenerate-all-btn")).toBeVisible()
  })
})

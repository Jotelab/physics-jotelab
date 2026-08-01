import { expect, test } from "@playwright/test"

test.describe("generate golden path", () => {
  test.describe.configure({ mode: "serial" })

  // A real 10-question run is a live model call per question, so the default
  // 30s test timeout expires before the 60s wait for the first question below.
  test.setTimeout(180_000)

  test("preset selection updates preview and generate fills questions", async ({ page }) => {
    await page.goto("/generate")
    await expect(page.locator("#generate-worksheet-btn")).toBeVisible({ timeout: 15_000 })

    const lessonInput = page.locator("#lesson-combobox")
    await lessonInput.click()
    await lessonInput.fill("Motion in one dimension")
    await page.locator("#lesson-listbox").getByRole("option", { name: "Motion in one dimension" }).click()

    await page.locator("#scenario-select").click()
    await page.locator("#scenario-listbox").getByRole("option", { name: "Find final velocity" }).click()

    // Rendered twice: the panel header and the editable worksheet title.
    await expect(page.getByText("Physics: Motion in one dimension").first()).toBeVisible()
    await expect(
      page.getByText(/questions - Find final velocity given initial velocity, acceleration, and time/i)
    ).toBeVisible()

    await page.locator("#generate-worksheet-btn").click()

    // "จงหา" ("find …") is the stable imperative every question opens with; the
    // noun after it varies with the target variable, so don't pin the full
    // phrase (the engine-backed path phrases "จงหาการกระจัด", "จงหาความเร่ง", …).
    await expect(page.getByText("จงหา", { exact: false }).first()).toBeVisible({
      timeout: 150_000,
    })
    // Only rendered once the whole worksheet is complete, which is the
    // remaining nine questions after the first one appeared above.
    await expect(page.locator("#regenerate-all-btn")).toBeVisible({ timeout: 150_000 })
  })
})

import { expect, test } from "@playwright/test"

/**
 * Live proof of the engine-outage contract (DEVELOPMENT_PLAN §1.2): when the
 * symbolic engine is unreachable the user sees the localized
 * ENGINE_UNAVAILABLE message — never the raw fetch error — and every reserved
 * credit is refunded.
 *
 * Gated behind the `engine-outage` project (E2E_ENGINE_OUTAGE=true) because it
 * needs a webServer with the *real* generation path pointed at a dead engine:
 *   E2E_STUB_GENERATION=false ENGINE_BASE_URL=http://127.0.0.1:59999
 * No Google AI key is required — the engine call fails before the LLM runs.
 */

const THAI_ENGINE_UNAVAILABLE =
  "ไม่สามารถเชื่อมต่อกับเอนจินคำนวณได้ในขณะนี้ ระบบได้คืนเครดิตให้แล้ว กรุณาลองใหม่อีกครั้ง"

test.describe("engine outage", () => {
  // The job walks every order through reserve → engine fail → retry → refund.
  test.describe.configure({ timeout: 180_000 })

  test("shows the Thai engine-unavailable error and refunds the credits", async ({
    page,
    baseURL,
  }) => {
    // The judge-facing failure copy must be Thai, so run the whole flow in th.
    await page.context().addCookies([
      {
        name: "NEXT_LOCALE",
        value: "th",
        domain: new URL(baseURL!).hostname,
        path: "/",
      },
    ])

    await page.goto("/generate")
    await expect(page.locator("#generate-worksheet-btn")).toBeVisible({ timeout: 15_000 })

    const lessonInput = page.locator("#lesson-combobox")
    await lessonInput.click()
    await lessonInput.fill("การเคลื่อนที่ในหนึ่งมิติ")
    await page
      .locator("#lesson-listbox")
      .getByRole("option", { name: "การเคลื่อนที่ในหนึ่งมิติ" })
      .click()

    // A scenario is required before the generate button enables.
    await page.locator("#scenario-select").click()
    await page
      .locator("#scenario-listbox")
      .getByRole("option", { name: "หาความเร็วสุดท้าย" })
      .click()

    // "เครดิตคงเหลือ" sits next to the tabular-nums balance span; capture the
    // balance before generating so the refund assertion is start-value agnostic.
    const creditsValue = page
      .getByText("เครดิตคงเหลือ", { exact: true })
      .locator("..")
      .locator("span")
      .nth(1)
    await expect(creditsValue).toHaveText(/^\d+$/)
    const creditsBefore = (await creditsValue.textContent())!.trim()

    await page.locator("#generate-worksheet-btn").click()

    // Every slot skips with the localized ENGINE_UNAVAILABLE copy (rendered by
    // SkippedQuestionBlock via the slot's failure code).
    await expect(
      page.getByText(THAI_ENGINE_UNAVAILABLE).first()
    ).toBeVisible({ timeout: 120_000 })

    // The raw client internals must never reach the user.
    await expect(page.getByText("Could not reach the symbolic engine")).toHaveCount(0)

    // Balance returns to its pre-generation value once the job terminates —
    // toHaveText retries through the transient reserved state.
    await expect(creditsValue).toHaveText(creditsBefore, { timeout: 30_000 })
  })
})

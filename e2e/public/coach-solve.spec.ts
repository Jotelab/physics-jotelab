import { expect, test } from "@playwright/test"

/**
 * Full coached solve on /learn with the stubbed engine payload (C1.3 / the C1
 * exit gate): one deliberately wrong equation choice must be classified with
 * the targeted micro-explanation, then the solve completes and the isomorphic
 * re-roll resets the session.
 *
 * Requires E2E_STUB_GENERATION=true (the webServer env forwards it):
 *   E2E_STUB_GENERATION=true npm run test:e2e:public
 *
 * Stub problem: u = 0, a = 2, t = 5 → v = 10 (equation v = u + at).
 */

test.describe("coached solve (stubbed engine)", () => {
  test.skip(
    process.env.E2E_STUB_GENERATION !== "true",
    "needs E2E_STUB_GENERATION=true so /learn renders without an engine service"
  )

  test("wrong equation gets the targeted explanation, then the solve completes and re-rolls", async ({
    page,
  }) => {
    const attemptLogs: string[] = []
    page.on("console", (message) => {
      if (message.text().includes("[coach-attempt]")) {
        attemptLogs.push(message.text())
      }
    })

    await page.goto("/learn")

    const equationStep = page.locator("section", { hasText: "① เลือกสมการ" })
    await expect(equationStep).toBeVisible({ timeout: 15_000 })

    // KaTeX keeps the LaTeX source in the MathML <annotation>; use it to tell
    // the correct relation (v = u + at) from a distractor.
    const options = equationStep.locator("button:has(annotation)")
    await expect(options).toHaveCount(4)
    const correctOption = options.filter({
      has: page.locator('annotation:text-is("v = u + at")'),
    })
    const wrongOption = options
      .filter({ hasNot: page.locator('annotation:text-is("v = u + at")') })
      .first()

    // First interaction: on a dev server the page can still be hydrating, so
    // retry the selection until the submit button reacts (i.e. onClick is live).
    await expect(async () => {
      await wrongOption.click()
      await expect(
        equationStep.getByRole("button", { name: "ตรวจสมการ" })
      ).toBeEnabled({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })

    // Attempt 1 (wrong): generic nudge.
    await equationStep.getByRole("button", { name: "ตรวจสมการ" }).click()
    await expect(equationStep.getByRole("status")).toContainText(
      "ลองดูว่าโจทย์ให้ค่าอะไรมาบ้าง"
    )

    // Attempt 2 (same wrong choice): the targeted wrong-equation explanation.
    await equationStep.getByRole("button", { name: "ตรวจสมการ" }).click()
    await expect(equationStep.getByRole("status")).toContainText(
      "สมการนี้มีตัวแปรที่โจทย์ไม่ได้ให้มา"
    )

    // Correct equation.
    await correctOption.click()
    await equationStep.getByRole("button", { name: "ตรวจสมการ" }).click()
    await expect(equationStep.getByText("✓ ถูกต้อง")).toBeVisible()

    // Step ②: substitute the stub's given values.
    const substitutionStep = page.locator("section", { hasText: "② แทนค่า" })
    await substitutionStep.locator("#sub-u").fill("0")
    await substitutionStep.locator("#sub-a").fill("2")
    await substitutionStep.locator("#sub-t").fill("5")
    await substitutionStep.getByRole("button", { name: "ตรวจการแทนค่า" }).click()
    await expect(substitutionStep.getByText("✓ ถูกต้อง")).toBeVisible()

    // Step ③: the answer.
    const answerStep = page.locator("section", { hasText: "③ คำนวณ" })
    await answerStep.locator("#coach-answer").fill("10")
    await answerStep.getByRole("button", { name: "ตรวจคำตอบ" }).click()

    const solvedPanel = page.locator("section", { hasText: "ถูกต้องครบทุกขั้น" })
    await expect(solvedPanel).toBeVisible()

    // Every checked input was logged, and the wrong step was classified.
    expect(
      attemptLogs.some((line) => line.includes('"errorType":"wrong-equation"'))
    ).toBe(true)
    expect(attemptLogs.length).toBeGreaterThanOrEqual(5)

    // The remediation loop is visible: the misconception the classifier named
    // on this problem is reported, and drives the recommended next step.
    await expect(solvedPanel.getByText("เลือกสมการผิด")).toBeVisible()
    await expect(solvedPanel.getByText("ขั้นต่อไปที่แนะนำ")).toBeVisible()
    await expect(
      solvedPanel.getByText("ทบทวนโจทย์รูปแบบเดิมอีกครั้ง", { exact: false })
    ).toBeVisible()

    // Isomorphic re-roll: same Given/Find structure, session reset.
    await solvedPanel
      .getByRole("button", { name: "โจทย์แบบเดียวกันข้อใหม่" })
      .click()
    await expect(
      page.locator("section", { hasText: "① เลือกสมการ" }).getByRole("button", {
        name: "ตรวจสมการ",
      })
    ).toBeVisible({ timeout: 15_000 })
    await expect(solvedPanel).toBeHidden()
  })
})

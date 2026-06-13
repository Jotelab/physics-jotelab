import { test as setup } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

import { applyTestUserSession } from "./utils/apply-test-user-session"

const authFile = path.join("e2e", ".auth", "user.json")

setup("authenticate test user", async ({ page, baseURL }) => {
  const cookieBase = baseURL ?? "http://127.0.0.1:3000"

  await applyTestUserSession(page, cookieBase)

  fs.mkdirSync(path.dirname(authFile), { recursive: true })
  await page.context().storageState({ path: authFile })

  await page.goto("/generate")
  await page.waitForURL(/\/generate/, { timeout: 15_000 })
})

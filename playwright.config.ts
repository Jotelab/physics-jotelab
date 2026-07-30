import { defineConfig } from "@playwright/test"

import { hasAuthenticatedE2E } from "./e2e/utils/env"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"

// A run that *expects* authenticated coverage must fail loudly when the
// credentials are absent. Silently dropping the `setup`/`authenticated`
// projects is how a broken auth helper survived unnoticed: `playwright test`
// exited 0 with the golden-path spec never executed. `E2E_EXPECT_AUTH` is set
// by `test:e2e:authenticated` and the CI authenticated job.
if (process.env.E2E_EXPECT_AUTH === "true" && !hasAuthenticatedE2E) {
  throw new Error(
    "E2E_EXPECT_AUTH=true but authenticated E2E credentials are missing. " +
      "Set E2E_TEST_USER_EMAIL, E2E_TEST_USER_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, " +
      "and NEXT_PUBLIC_SUPABASE_ANON_KEY (see scripts/ci-supabase-e2e-env.sh) — " +
      "refusing to silently skip the authenticated specs."
  )
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    ...(hasAuthenticatedE2E
      ? [
          {
            name: "setup",
            testMatch: /auth\.setup\.ts/,
          },
        ]
      : []),
    {
      name: "public",
      testMatch: /public\/.*\.spec\.ts/,
    },
    ...(hasAuthenticatedE2E
      ? [
          {
            name: "authenticated",
            testMatch: /authenticated\/.*\.spec\.ts/,
            fullyParallel: false,
            dependencies: ["setup"],
            use: {
              storageState: "e2e/.auth/user.json",
            },
          },
        ]
      : []),
  ],
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
      E2E_STUB_GENERATION: process.env.E2E_STUB_GENERATION ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET ?? "",
    },
  },
})

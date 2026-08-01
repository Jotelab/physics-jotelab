import { defineConfig } from "@playwright/test"

import { hasAuthenticatedE2E } from "./e2e/utils/env"

// `localhost`, not `127.0.0.1`: Next dev blocks cross-origin requests to
// `/_next/*` dev resources, and the dev server's own origin is `localhost`.
// Driving it over `127.0.0.1` gets the client runtime blocked, so the page
// serves its SSR HTML but never hydrates — every interaction silently no-ops.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

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

import path from "node:path"
import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@/features/worksheet/actions/update-worksheet-header",
        replacement: path.resolve(rootDir, "tests/mocks/update-worksheet-header.ts"),
      },
      {
        // `server-only` is resolved by the Next.js bundler, not a real package;
        // map it to a no-op so server modules guarded by it can be unit-tested.
        find: "server-only",
        replacement: path.resolve(rootDir, "tests/mocks/server-only.ts"),
      },
    ],
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    coverage: {
      provider: "v8",
      reporter: process.env.CI ? ["text", "json-summary"] : ["text"],
      include: [
        "features/generate/*.{ts,tsx}",
        "features/generate/data/**/*.{ts,tsx}",
        "features/generate/utils/**/*.{ts,tsx}",
        "features/generate/hooks/use-worksheet-generator.ts",
        "features/worksheet/**/*.{ts,tsx}",
        "lib/ai/**/*.{ts,tsx}",
        "proxy.ts",
      ],
      exclude: [
        "**/*.{test,spec}.{ts,tsx}",
        "**/*.d.ts",
        "features/**/components/**",
      ],
      thresholds: {
        "features/generate/**": {
          branches: 70,
          lines: 80,
          statements: 80,
          functions: 85,
        },
      },
    },
  },
})

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
    // Anchored globs, not bare names: a bare "node_modules" only matches the
    // path at the repo root, so a nested checkout (a git worktree under
    // `.claude/worktrees/`, which carries its own `node_modules` and Playwright
    // `e2e/` specs) got scanned and reported ~129 phantom failed files. The
    // `**/` forms exclude those at any depth, so `vitest run` reports this
    // project's tests and nothing else.
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**", "**/.claude/**"],
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
        "lib/engine/**/*.{ts,tsx}",
        "features/coach/**/*.{ts,tsx}",
        "proxy.ts",
      ],
      exclude: [
        "**/*.{test,spec}.{ts,tsx}",
        "**/*.d.ts",
        "features/**/components/**",
      ],
      // Floors, not aspirations: each is set just below what the suite measured
      // when the threshold was added, so it locks in coverage already earned and
      // fails when a change erodes it. Raise them when the numbers rise; never
      // lower one to make a build pass.
      thresholds: {
        "features/generate/**": {
          branches: 70,
          lines: 80,
          statements: 80,
          functions: 85,
        },
        // The engine boundary: contract parsing, topic routing, assembly.
        "lib/engine/**": {
          branches: 70,
          lines: 90,
          statements: 90,
          functions: 90,
        },
        // The coach: oracle, classifier, remediation — all pure and testable.
        "features/coach/**": {
          branches: 72,
          lines: 88,
          statements: 88,
          functions: 90,
        },
        // Lower by design: this layer is mostly model I/O, exercised end to end
        // rather than by unit tests. The floor stops it sliding further.
        "lib/ai/**": {
          branches: 55,
          lines: 65,
          statements: 65,
          functions: 70,
        },
      },
    },
  },
})

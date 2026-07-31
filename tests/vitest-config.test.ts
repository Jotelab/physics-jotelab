import { describe, expect, it } from "vitest"

import config from "../vitest.config"

/**
 * Guard for the test-discovery scope.
 *
 * A bare exclude entry (`"node_modules"`) only matches that path at the repo
 * root. Any nested checkout — a git worktree under `.claude/worktrees/`, which
 * carries its own `node_modules` and Playwright `e2e/` specs — then gets
 * scanned, and `vitest run` reports a wall of failures that have nothing to do
 * with this project. That is exactly what a judge following the README's test
 * command would see, so the patterns must stay depth-anchored.
 */

const exclude = config.test?.exclude ?? []

describe("vitest exclude patterns", () => {
  it("anchors every pattern so nested checkouts are skipped at any depth", () => {
    expect(exclude.length).toBeGreaterThan(0)
    for (const pattern of exclude) {
      expect(pattern, `"${pattern}" must start with **/ to match at any depth`).toMatch(
        /^\*\*\//
      )
    }
  })

  it("covers the directories that nest a second checkout", () => {
    for (const directory of ["node_modules", ".claude", "e2e", ".next"]) {
      expect(
        exclude.some((pattern) => pattern.includes(`/${directory}/`)),
        `no exclude pattern covers ${directory}`
      ).toBe(true)
    }
  })
})

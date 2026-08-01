import { describe, expect, it } from "vitest"

import { SUVAT_RELATIONS, relationForSplit } from "./equations"
import { planNextProblem, SIGN_DRILL_ACCELERATIONS } from "./remediation"
import type { CoachErrorType } from "./types"

/** The split of the problem "just finished" in most cases below (v = u + at). */
const V_UAT = { given: ["u", "a", "t"], find: "v" } as const

function plan(
  errors: readonly CoachErrorType[],
  overrides: Partial<Parameters<typeof planNextProblem>[0]> = {}
) {
  return planNextProblem({
    errors,
    given: V_UAT.given,
    find: V_UAT.find,
    difficulty: "easy",
    completed: 0,
    ...overrides,
  })
}

describe("planNextProblem", () => {
  describe("conceptual misses repeat the same shape", () => {
    it("repeats the split after a wrong-equation miss", () => {
      const next = plan(["wrong-equation"])
      expect(next.kind).toBe("repeat-split")
      expect(next.params.given).toEqual(["u", "a", "t"])
      expect(next.params.find).toBe("v")
      expect(next.params.difficulty).toBe("easy")
    })

    it("repeats the split after swapped variables", () => {
      expect(plan(["swapped-variables"]).kind).toBe("repeat-split")
    })

    it("does not escalate difficulty while a concept is unresolved", () => {
      const next = plan(["wrong-equation"], { difficulty: "medium" })
      expect(next.params.difficulty).toBe("medium")
    })

    it("prefers the conceptual miss when mixed with an execution slip", () => {
      expect(plan(["arithmetic-slip", "wrong-equation"]).kind).toBe("repeat-split")
    })
  })

  describe("sign errors get a forced-negative drill", () => {
    it("pins a negative acceleration on a coachable split", () => {
      const next = plan(["sign-error"])
      expect(next.kind).toBe("sign-drill")
      expect(next.params.conditions?.a).toBeLessThan(0)
      expect(next.params.given).toContain("a")
    })

    it("only pins givens the split actually contains", () => {
      const next = plan(["sign-error"])
      for (const symbol of Object.keys(next.params.conditions ?? {})) {
        expect(next.params.given).toContain(symbol)
      }
    })

    it("varies the pinned value across a session so drills are not identical", () => {
      const values = SIGN_DRILL_ACCELERATIONS.map(
        (_, index) => plan(["sign-error"], { completed: index }).params.conditions?.a
      )
      expect(new Set(values).size).toBe(SIGN_DRILL_ACCELERATIONS.length)
    })

    it("emits a split the equation bank can coach", () => {
      const next = plan(["sign-error"])
      expect(relationForSplit(next.params.given!, next.params.find!)).not.toBeNull()
    })
  })

  describe("execution slips keep the shape and refresh the numbers", () => {
    it.each<CoachErrorType>(["arithmetic-slip", "unit-slip", "value-slip"])(
      "re-rolls the same split after %s",
      (errorType) => {
        const next = plan([errorType])
        expect(next.kind).toBe("same-shape")
        expect(next.params.given).toEqual(["u", "a", "t"])
        expect(next.params.difficulty).toBe("easy")
      }
    )
  })

  describe("a clean solve advances", () => {
    it("steps easy → medium", () => {
      const next = plan([])
      expect(next.kind).toBe("advance")
      expect(next.params.difficulty).toBe("medium")
    })

    it("steps medium → hard", () => {
      expect(plan([], { difficulty: "medium" }).params.difficulty).toBe("hard")
    })

    it("moves to a different relation once hard is solved clean", () => {
      const next = plan([], { difficulty: "hard" })
      expect(next.kind).toBe("new-split")
      const previous = relationForSplit(V_UAT.given, V_UAT.find)
      const chosen = relationForSplit(next.params.given!, next.params.find!)
      expect(chosen).not.toBeNull()
      expect(chosen!.id).not.toBe(previous!.id)
    })

    it("rotates through the bank on repeated mastery", () => {
      const ids = SUVAT_RELATIONS.map((_, index) => {
        const next = plan([], { difficulty: "hard", completed: index })
        return relationForSplit(next.params.given!, next.params.find!)!.id
      })
      expect(new Set(ids).size).toBeGreaterThan(1)
    })
  })

  it("always produces a coachable split", () => {
    const errorSets: CoachErrorType[][] = [
      [],
      ["wrong-equation"],
      ["sign-error"],
      ["unit-slip"],
      ["swapped-variables", "sign-error"],
    ]
    for (const errors of errorSets) {
      for (const difficulty of ["easy", "medium", "hard"] as const) {
        for (let completed = 0; completed < 6; completed++) {
          const next = plan(errors, { difficulty, completed })
          if (next.params.given && next.params.find) {
            expect(
              relationForSplit(next.params.given, next.params.find),
              `${next.kind} @ ${difficulty}/${completed}`
            ).not.toBeNull()
          }
        }
      }
    }
  })

  describe("persistent misconceptions outrank a single clean solve", () => {
    it("does not advance the band while the same concept keeps recurring", () => {
      const next = plan([], {
        history: ["wrong-equation", "wrong-equation", "wrong-equation"],
      })
      expect(next.kind).toBe("consolidate")
      expect(next.params.difficulty).toBe("easy")
    })

    it("keeps drilling signs after a clean solve when signs keep slipping", () => {
      const next = plan([], {
        history: ["sign-error", "sign-error", "sign-error"],
      })
      expect(next.kind).toBe("sign-drill")
      expect(next.params.conditions?.a).toBeLessThan(0)
    })

    it("advances normally when the history is short", () => {
      const next = plan([], { history: ["wrong-equation"] })
      expect(next.kind).toBe("advance")
      expect(next.params.difficulty).toBe("medium")
    })

    it("advances normally when errors are scattered rather than persistent", () => {
      const next = plan([], {
        history: ["wrong-equation", "sign-error", "unit-slip", "arithmetic-slip"],
      })
      expect(next.kind).toBe("advance")
    })

    it("ignores history when the student just made a fresh mistake", () => {
      // The current problem's diagnosis is more informative than the trend.
      const next = plan(["unit-slip"], {
        history: ["wrong-equation", "wrong-equation", "wrong-equation"],
      })
      expect(next.kind).toBe("same-shape")
    })

    it("treats an absent history as no history", () => {
      expect(plan([]).kind).toBe("advance")
    })
  })

  describe("the sign drill derives its split rather than hardcoding one", () => {
    it("targets a relation whose givens actually include acceleration", () => {
      const next = plan(["sign-error"])
      expect(next.params.given).toContain("a")
      expect(relationForSplit(next.params.given!, next.params.find!)).not.toBeNull()
    })

    it("pins only physically plausible decelerations", () => {
      // Braking-range magnitudes: a drill should look like a real vehicle
      // slowing down, not an arbitrary number.
      for (const a of SIGN_DRILL_ACCELERATIONS) {
        expect(a).toBeLessThan(0)
        expect(Math.abs(a)).toBeGreaterThanOrEqual(2)
        expect(Math.abs(a)).toBeLessThanOrEqual(5)
      }
    })
  })

  it("gives every plan a Thai reason for the student", () => {
    for (const errors of [[], ["wrong-equation"], ["sign-error"], ["unit-slip"]] as const) {
      const next = plan(errors)
      expect(next.reason.length).toBeGreaterThan(0)
      expect(next.reason).toMatch(/[฀-๿]/)
    }
  })
})

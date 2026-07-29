import { describe, expect, it } from "vitest"

import { summarizeAttempts, type CoachingAttemptRow } from "./progress"

function row(partial: Partial<CoachingAttemptRow>): CoachingAttemptRow {
  return {
    question_key: "suvat:1:v",
    step: "answer",
    error_type: null,
    solved: true,
    ...partial,
  }
}

describe("summarizeAttempts", () => {
  it("counts a problem as solved once, on a solved answer step only", () => {
    const summary = summarizeAttempts([
      row({ question_key: "suvat:1:v" }),
      row({ question_key: "suvat:1:v" }), // re-check of the same question
      row({ question_key: "suvat:2:s" }),
      row({ question_key: "suvat:3:a", step: "equation", solved: true }), // not the answer step
      row({ question_key: "suvat:4:t", solved: false }),
    ])

    expect(summary.problemsSolved).toBe(2)
    expect(summary.attempts).toBe(5)
  })

  it("ranks common error types by count, alphabetical on ties, top three", () => {
    const summary = summarizeAttempts([
      row({ solved: false, error_type: "sign-error" }),
      row({ solved: false, error_type: "sign-error" }),
      row({ solved: false, error_type: "wrong-equation" }),
      row({ solved: false, error_type: "arithmetic-slip" }),
      row({ solved: false, error_type: "value-slip" }),
      row({ solved: true, error_type: null }), // correct steps carry no error
    ])

    expect(summary.topErrors).toEqual([
      { errorType: "sign-error", count: 2 },
      { errorType: "arithmetic-slip", count: 1 },
      { errorType: "value-slip", count: 1 },
    ])
  })

  it("summarizes no attempts as zeros", () => {
    expect(summarizeAttempts([])).toEqual({
      problemsSolved: 0,
      attempts: 0,
      topErrors: [],
    })
  })
})

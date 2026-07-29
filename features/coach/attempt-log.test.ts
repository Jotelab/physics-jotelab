import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  attemptLog,
  clearAttemptLog,
  recordAttempt,
  setAttemptTransport,
} from "./attempt-log"

const BASE = {
  questionKey: "suvat:1:v",
  step: "equation" as const,
  input: "v-uat",
  errorType: null,
  hintsUsed: 0,
  solved: true,
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {})
})

afterEach(() => {
  clearAttemptLog()
  setAttemptTransport(null)
  vi.restoreAllMocks()
})

describe("attempt transport", () => {
  it("forwards each recorded attempt to the registered transport", () => {
    const sent: unknown[] = []
    setAttemptTransport(async (record) => {
      sent.push(record)
    })

    const record = recordAttempt(BASE)

    expect(sent).toEqual([record])
  })

  it("records nothing extra and stays silent with no transport registered", () => {
    const record = recordAttempt(BASE)

    expect(attemptLog()).toEqual([record])
  })

  it("keeps recording when the transport rejects", async () => {
    setAttemptTransport(async () => {
      throw new Error("db down")
    })

    expect(() => recordAttempt(BASE)).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(attemptLog()).toHaveLength(1)
  })
})

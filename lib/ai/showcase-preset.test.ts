import { afterEach, describe, expect, it, vi } from "vitest"

import { generatedQuestionSchema } from "@/features/generate/schemas"

import {
  SHOWCASE_PRESET_QUESTIONS,
  getShowcasePresetQuestion,
} from "./showcase-preset"

const MOTION_1D_AT_4_STARS: Parameters<typeof getShowcasePresetQuestion>[0] = {
  lesson: "motion-1d",
  subject: "physics",
  starDifficulty: 4,
  previousQuestionsContext: [],
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("SHOWCASE_PRESET_QUESTIONS", () => {
  it("every bank question passes the generated-question schema", () => {
    for (const question of SHOWCASE_PRESET_QUESTIONS) {
      expect(generatedQuestionSchema.safeParse(question).success).toBe(true)
    }
  })

  it("every bank question carries a suvat engine payload with a solved answer", () => {
    for (const question of SHOWCASE_PRESET_QUESTIONS) {
      expect(question.sympy_data?.topic).toBe("suvat")
      expect(question.sympy_data?.final_answer.value).toBe(
        question.sympy_data?.find.value
      )
    }
  })

  it("question texts are distinct so rotation shows a varied worksheet", () => {
    const texts = new Set(SHOWCASE_PRESET_QUESTIONS.map((q) => q.question_text))
    expect(texts.size).toBe(SHOWCASE_PRESET_QUESTIONS.length)
  })

  it("bank physics is self-consistent (kinematics check on each payload)", () => {
    for (const question of SHOWCASE_PRESET_QUESTIONS) {
      const data = question.sympy_data
      expect(data).toBeDefined()
      if (!data) continue

      const values = new Map<string, number>(
        data.given.map((given) => [given.symbol, given.value])
      )
      values.set(data.find.symbol, data.find.value)

      const u = values.get("u")
      const v = values.get("v")
      const a = values.get("a")
      const t = values.get("t")
      const s = values.get("s")

      // Every payload pins enough of {u, v, a, t, s} that at least one SUVAT
      // relation is fully determined; check each relation whose variables are
      // all present.
      let checked = 0
      if (u != null && v != null && a != null && t != null) {
        expect(v).toBeCloseTo(u + a * t)
        checked += 1
      }
      if (u != null && v != null && t != null && s != null) {
        expect(s).toBeCloseTo(((u + v) / 2) * t)
        checked += 1
      }
      if (u != null && a != null && t != null && s != null) {
        expect(s).toBeCloseTo(u * t + 0.5 * a * t * t)
        checked += 1
      }
      if (u != null && v != null && a != null && s != null) {
        expect(v * v).toBeCloseTo(u * u + 2 * a * s)
        checked += 1
      }
      expect(checked).toBeGreaterThan(0)
    }
  })
})

describe("getShowcasePresetQuestion", () => {
  it("returns null when the hidden setting is off", () => {
    vi.stubEnv("SHOWCASE_PRESET", "")
    expect(getShowcasePresetQuestion(MOTION_1D_AT_4_STARS)).toBeNull()
  })

  it("returns null for other lessons or star levels even when enabled", () => {
    vi.stubEnv("SHOWCASE_PRESET", "true")
    expect(
      getShowcasePresetQuestion({ ...MOTION_1D_AT_4_STARS, lesson: "free-fall" })
    ).toBeNull()
    expect(
      getShowcasePresetQuestion({ ...MOTION_1D_AT_4_STARS, starDifficulty: 3 })
    ).toBeNull()
    expect(
      getShowcasePresetQuestion({ ...MOTION_1D_AT_4_STARS, starDifficulty: undefined })
    ).toBeNull()
  })

  it("serves motion-1d at 4 stars, walking the bank in order", () => {
    vi.stubEnv("SHOWCASE_PRESET", "true")

    const context: string[] = []
    for (const expected of SHOWCASE_PRESET_QUESTIONS) {
      const question = getShowcasePresetQuestion({
        ...MOTION_1D_AT_4_STARS,
        previousQuestionsContext: context,
      })
      expect(question?.question_text).toBe(expected.question_text)
      if (question) context.push(question.question_text)
    }
  })

  it("wraps around once the whole bank has been served", () => {
    vi.stubEnv("SHOWCASE_PRESET", "true")

    const fullContext = SHOWCASE_PRESET_QUESTIONS.map((q) => q.question_text)
    const question = getShowcasePresetQuestion({
      ...MOTION_1D_AT_4_STARS,
      previousQuestionsContext: fullContext,
    })
    expect(question?.question_text).toBe(
      SHOWCASE_PRESET_QUESTIONS[
        fullContext.length % SHOWCASE_PRESET_QUESTIONS.length
      ].question_text
    )
  })

  it("re-rolls to a different question than the original", () => {
    vi.stubEnv("SHOWCASE_PRESET", "true")

    const original = SHOWCASE_PRESET_QUESTIONS[0]
    const question = getShowcasePresetQuestion({
      ...MOTION_1D_AT_4_STARS,
      previousQuestionsContext: [original.question_text],
    })
    expect(question).not.toBeNull()
    expect(question?.question_text).not.toBe(original.question_text)
  })
})

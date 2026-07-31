import { resolveLessonKey } from "@/features/generate/data/generation-presets"
import type { GeneratedQuestion, Subject } from "@/features/generate/types"
import { assembleEngineQuestion } from "@/lib/engine/assemble-question"
import type { SympyData } from "@/lib/engine/sympy-data"
import { SUVAT } from "@/lib/engine/topics"

/**
 * Showcase preset (hidden demo setting, local clone only).
 *
 * `SHOWCASE_PRESET=true` swaps generation for a curated bank of realistic Thai
 * motion-1d questions instead of the single trivial E2E stub — so a live demo
 * of the full worksheet flow (generate → preview → answers → variants) shows
 * convincing content without the engine, an LLM key, or Inngest.
 *
 * The setting is deliberately narrow ("hidden"): it only fires for lesson
 * `motion-1d` at star difficulty 4 — any other topic/star combination falls
 * through to the normal path (which in this clone is the E2E stub). Each bank
 * entry is hand-verified and assembled through {@link assembleEngineQuestion}
 * with a full `sympy_data` payload, so it is shaped exactly like a real
 * engine-backed question and survives the DB allowlist round-trip.
 *
 * Note on structure: the star ladder's 4★ plans live on the pursuit /
 * two-phase-ascent topics; for suvat itself a 4★ request honestly falls back
 * down the ladder (see `pickStarPlan`). The bank mirrors that: hidden
 * conditions ("เบรกจนหยุดนิ่ง" → v = 0, "ปล่อยตัวจากหยุดนิ่ง" → u = 0),
 * a genuine quadratic time solve, and working-backwards rearrangements.
 */

export const SHOWCASE_LESSON_ID = "motion-1d"
export const SHOWCASE_STAR_DIFFICULTY = 4

export function isShowcasePresetEnabled(): boolean {
  return process.env.SHOWCASE_PRESET === "true"
}

type ShowcaseEntry = {
  questionText: string
  sympyData: SympyData
}

const SHOWCASE_ENTRIES: ShowcaseEntry[] = [
  {
    // Braking to a stop (hidden v = 0): s = (u + v)t/2 = 40 m
    questionText:
      "รถจักรยานยนต์แล่นบนถนนตรงด้วยความเร็ว 20 เมตร/วินาที ผู้ขับเห็นสัญญาณไฟแดงจึงเบรกให้รถเคลื่อนที่ช้าลงอย่างสม่ำเสมอจนหยุดนิ่ง โดยใช้เวลา 4 วินาที จงหาระยะทางที่รถเคลื่อนที่ได้ตั้งแต่เริ่มเบรกจนหยุด",
    sympyData: {
      topic: "suvat",
      seed: 9401,
      given: [
        { symbol: "u", value: 20, exact: "20", unit: "m/s" },
        { symbol: "v", value: 0, exact: "0", unit: "m/s" },
        { symbol: "t", value: 4, exact: "4", unit: "s" },
      ],
      find: { symbol: "s", value: 40, exact: "40", unit: "m" },
      steps: [
        {
          expr_latex: "s = \\frac{(u + v)t}{2}",
          substituted_latex: "s = \\frac{(20 + 0)\\cdot 4}{2}",
          result_latex: "s = 40\\ \\text{m}",
        },
      ],
      final_answer: { value: 40, exact: "40", unit: "m", latex: "40\\ \\text{m}" },
      policy_applied: "easy",
      plausible: true,
    },
  },
  {
    // Quadratic time solve with root selection: 50 = 5t + t² → t = 5 s
    questionText:
      "รถยนต์คันหนึ่งกำลังแล่นด้วยความเร็ว 5 เมตร/วินาที เมื่อถึงต้นสะพานซึ่งยาว 50 เมตร ก็เร่งเครื่องด้วยความเร่งคงตัว 2 เมตร/วินาที² จงหาว่ารถใช้เวลานานเท่าใดจึงข้ามสะพานพ้นพอดี",
    sympyData: {
      topic: "suvat",
      seed: 9402,
      given: [
        { symbol: "u", value: 5, exact: "5", unit: "m/s" },
        { symbol: "a", value: 2, exact: "2", unit: "m/s^2" },
        { symbol: "s", value: 50, exact: "50", unit: "m" },
      ],
      find: { symbol: "t", value: 5, exact: "5", unit: "s" },
      steps: [
        {
          expr_latex: "s = ut + \\frac{1}{2}at^{2}",
          substituted_latex: "50 = 5t + \\frac{1}{2}\\cdot 2\\cdot t^{2}",
          result_latex: "t^{2} + 5t - 50 = 0",
        },
        {
          expr_latex: "(t - 5)(t + 10) = 0",
          substituted_latex: "t = 5,\\ t = -10",
          result_latex: "t = 5\\ \\text{s}\\ (t > 0)",
        },
      ],
      final_answer: { value: 5, exact: "5", unit: "s", latex: "5\\ \\text{s}" },
      policy_applied: "easy",
      plausible: true,
    },
  },
  {
    // Working backwards for a via the no-time route: a = (v² − u²)/2s = 2 m/s²
    questionText:
      "รถไฟฟ้าขบวนหนึ่งเพิ่มความเร็วอย่างสม่ำเสมอจาก 10 เมตร/วินาที เป็น 20 เมตร/วินาที ในระยะทาง 75 เมตร จงหาความเร่งของรถไฟฟ้า",
    sympyData: {
      topic: "suvat",
      seed: 9403,
      given: [
        { symbol: "u", value: 10, exact: "10", unit: "m/s" },
        { symbol: "v", value: 20, exact: "20", unit: "m/s" },
        { symbol: "s", value: 75, exact: "75", unit: "m" },
      ],
      find: { symbol: "a", value: 2, exact: "2", unit: "m/s^2" },
      steps: [
        {
          expr_latex: "v^{2} = u^{2} + 2as",
          substituted_latex: "20^{2} = 10^{2} + 2\\cdot a\\cdot 75",
          result_latex: "a = 2\\ \\text{m/s}^{2}",
        },
      ],
      final_answer: { value: 2, exact: "2", unit: "m/s^2", latex: "2\\ \\text{m/s}^{2}" },
      policy_applied: "easy",
      plausible: true,
    },
  },
  {
    // From rest (hidden u = 0), recover the time: t = √(2s/a) = 5 s
    questionText:
      "รถไฟเหาะในสวนสนุกถูกปล่อยตัวจากหยุดนิ่ง แล้วเร่งด้วยความเร่งคงตัว 8 เมตร/วินาที² ไปตามรางตรงยาว 100 เมตร จงหาเวลาที่ใช้ในการเคลื่อนที่ช่วงนี้",
    sympyData: {
      topic: "suvat",
      seed: 9404,
      given: [
        { symbol: "u", value: 0, exact: "0", unit: "m/s" },
        { symbol: "a", value: 8, exact: "8", unit: "m/s^2" },
        { symbol: "s", value: 100, exact: "100", unit: "m" },
      ],
      find: { symbol: "t", value: 5, exact: "5", unit: "s" },
      steps: [
        {
          expr_latex: "s = ut + \\frac{1}{2}at^{2}",
          substituted_latex: "100 = 0\\cdot t + \\frac{1}{2}\\cdot 8\\cdot t^{2}",
          result_latex: "t^{2} = 25",
        },
        {
          expr_latex: "t = \\sqrt{\\frac{2s}{a}}",
          substituted_latex: "t = \\sqrt{25}",
          result_latex: "t = 5\\ \\text{s}",
        },
      ],
      final_answer: { value: 5, exact: "5", unit: "s", latex: "5\\ \\text{s}" },
      policy_applied: "easy",
      plausible: true,
    },
  },
  {
    // Working backwards for the initial speed: u = v − at = 10 m/s
    questionText:
      "รถกระบะเร่งความเร็วอย่างสม่ำเสมอด้วยความเร่ง 4 เมตร/วินาที² เป็นเวลา 5 วินาที ทำให้มีความเร็วปลายเป็น 30 เมตร/วินาที จงหาความเร็วของรถขณะเริ่มเร่งเครื่อง",
    sympyData: {
      topic: "suvat",
      seed: 9405,
      given: [
        { symbol: "v", value: 30, exact: "30", unit: "m/s" },
        { symbol: "a", value: 4, exact: "4", unit: "m/s^2" },
        { symbol: "t", value: 5, exact: "5", unit: "s" },
      ],
      find: { symbol: "u", value: 10, exact: "10", unit: "m/s" },
      steps: [
        {
          expr_latex: "v = u + at",
          substituted_latex: "30 = u + 4\\cdot 5",
          result_latex: "u = 10\\ \\text{m/s}",
        },
      ],
      final_answer: { value: 10, exact: "10", unit: "m/s", latex: "10\\ \\text{m/s}" },
      policy_applied: "easy",
      plausible: true,
    },
  },
  {
    // Braking to a stop (hidden v = 0), recover the time: t = 2s/u = 4 s
    questionText:
      "รถโดยสารแล่นด้วยความเร็ว 24 เมตร/วินาที ผู้ขับเบรกให้รถเคลื่อนที่ช้าลงอย่างสม่ำเสมอจนหยุดนิ่งในระยะทาง 48 เมตร จงหาเวลาที่ใช้ในการเบรก",
    sympyData: {
      topic: "suvat",
      seed: 9406,
      given: [
        { symbol: "u", value: 24, exact: "24", unit: "m/s" },
        { symbol: "v", value: 0, exact: "0", unit: "m/s" },
        { symbol: "s", value: 48, exact: "48", unit: "m" },
      ],
      find: { symbol: "t", value: 4, exact: "4", unit: "s" },
      steps: [
        {
          expr_latex: "s = \\frac{(u + v)t}{2}",
          substituted_latex: "48 = \\frac{(24 + 0)\\cdot t}{2}",
          result_latex: "t = 4\\ \\text{s}",
        },
      ],
      final_answer: { value: 4, exact: "4", unit: "s", latex: "4\\ \\text{s}" },
      policy_applied: "easy",
      plausible: true,
    },
  },
]

/** The assembled bank, shaped exactly like real engine-backed questions. */
export const SHOWCASE_PRESET_QUESTIONS: GeneratedQuestion[] = SHOWCASE_ENTRIES.map(
  (entry) => assembleEngineQuestion(entry.sympyData, SUVAT, entry.questionText)
)

/**
 * The preset question for one generation call, or `null` when the hidden
 * setting is off or the request is not motion-1d at 4★.
 *
 * Rotation: the first bank entry whose text is not already in the previous-
 * questions context — sequential worksheet generation walks the bank in order,
 * and a re-roll serves an entry different from the original. Sheets longer
 * than the bank wrap around by context length.
 */
export function getShowcasePresetQuestion(input: {
  lesson: string
  subject: Subject
  starDifficulty?: number
  previousQuestionsContext: string[]
}): GeneratedQuestion | null {
  if (!isShowcasePresetEnabled()) return null
  if (input.starDifficulty !== SHOWCASE_STAR_DIFFICULTY) return null

  const { lessonId } = resolveLessonKey(input.lesson, input.subject)
  if (lessonId !== SHOWCASE_LESSON_ID) return null

  const used = new Set(input.previousQuestionsContext)
  const unused = SHOWCASE_PRESET_QUESTIONS.find(
    (question) => !used.has(question.question_text)
  )
  return (
    unused ??
    SHOWCASE_PRESET_QUESTIONS[
      input.previousQuestionsContext.length % SHOWCASE_PRESET_QUESTIONS.length
    ]
  )
}

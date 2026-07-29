import type { CoachErrorType, CoachStep } from "./types"

/**
 * The micro-explanation bank (C1.2): one short Thai explanation per error type
 * per step, authored by hand — deterministic and reviewable. The LLM may later
 * polish phrasing, but it never *judges*; these strings are what the classifier
 * points at.
 *
 * Hints escalate per C1.1: nudge → targeted explanation → worked step. The
 * worked-step reveal itself renders the engine's LaTeX (see
 * `CoachProblem.workedStep`), so this bank only carries prose.
 */

export type HintLevel = "nudge" | "targeted" | "worked"

/** Generic first-try nudges, one per step. */
export const NUDGES: Record<CoachStep, string> = {
  equation:
    "ลองดูว่าโจทย์ให้ค่าอะไรมาบ้าง และถามหาอะไร — สมการที่ถูกต้องจะเชื่อมปริมาณเหล่านั้นทั้งหมดโดยไม่มีตัวแปรอื่นเกินมา",
  substitution:
    "แทนค่าทีละตัว: อ่านโจทย์อีกครั้งแล้วจับคู่ตัวเลขกับสัญลักษณ์ให้ตรง อย่าลืมเครื่องหมายบวกลบ",
  answer:
    "ตรวจการคำนวณอีกครั้งทีละขั้น และดูว่าหน่วยของคำตอบตรงกับที่โจทย์ถามหรือไม่",
}

/** Targeted micro-explanations, per error type (per step where wording differs). */
export const EXPLANATIONS: Record<CoachErrorType, string> = {
  "wrong-equation":
    "สมการนี้มีตัวแปรที่โจทย์ไม่ได้ให้มา หรือขาดตัวแปรที่ต้องการหา — เลือกสมการที่ประกอบด้วยปริมาณที่โจทย์กำหนดให้ครบทั้งสามตัวและปริมาณที่ต้องการหาเท่านั้น",
  "swapped-variables":
    "ค่าที่แทนสลับตำแหน่งกัน เช่น ความเร็วต้น (v₀) กับความเร็วปลาย (v) — v₀ คือความเร็ว 'ตอนเริ่ม' เหตุการณ์ ส่วน v คือความเร็ว 'ตอนจบ' ลองอ่านโจทย์แล้วดูว่าเลขไหนเกิดก่อน",
  "sign-error":
    "เครื่องหมายไม่ถูกต้อง — ปริมาณที่มีทิศตรงข้ามกับทิศบวกที่กำหนด (เช่น การชะลอตัว) ต้องแทนด้วยค่าลบ",
  "unit-slip":
    "ตัวเลขถูกแนวทางแล้ว แต่หน่วยคลาดเคลื่อน — ตรวจว่าแปลงหน่วยครบหรือยัง (เช่น km/h ↔ m/s ต้องหารหรือคูณด้วย 3.6)",
  "arithmetic-slip":
    "การแทนค่าถูกต้องแล้ว แต่ผลการคำนวณคลาดเคลื่อน — เป็นเพียงความพลาดในการคิดเลข ลองคำนวณใหม่ช้า ๆ ทีละขั้น",
  "value-slip":
    "มีค่าที่แทนไม่ตรงกับที่โจทย์กำหนด — กลับไปอ่านโจทย์แล้วตรวจตัวเลขทีละตัวอีกครั้ง",
}

/** Section headers for the worked-step reveal, per step. */
export const WORKED_LABELS: Record<CoachStep, string> = {
  equation: "สมการที่ใช้คือ",
  substitution: "การแทนค่าที่ถูกต้องคือ",
  answer: "ขั้นตอนคำตอบที่ถูกต้องคือ",
}

/**
 * The escalation ladder (C1.1): attempt 1 misses get a nudge, attempt 2 the
 * targeted micro-explanation, attempt 3+ the worked step — after which the UI
 * offers an isomorphic re-roll ("wrong answer ≠ reveal" only holds until the
 * ladder is exhausted; then the step is taught, not withheld).
 */
export function hintLevelForAttempt(attempt: number): HintLevel {
  if (attempt <= 1) return "nudge"
  if (attempt === 2) return "targeted"
  return "worked"
}

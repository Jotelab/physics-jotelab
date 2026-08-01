import { SUVAT_RELATIONS, relationForSplit, type SuvatRelation } from "./equations"
import type { CoachDifficulty, CoachErrorType } from "./types"

/**
 * Misconception-driven problem selection (C1.2 → C1.1 loop closure).
 *
 * The classifier already names *what* the student got wrong; this turns that
 * label into the *next problem*, so a diagnosis changes what the app serves
 * instead of only what it says. Every decision is a plain rule over the error
 * set — auditable and deterministic, the same discipline as `classify.ts`. No
 * model chooses anything here, and the engine still owns every number: a plan
 * is only a set of `/generate` constraints (split, difficulty, pinned values).
 *
 * Priority order, highest first:
 *  1. **Conceptual miss** (`wrong-equation`, `swapped-variables`) — the student
 *     cannot yet map this Given/Find shape to its relation, so repeat the shape
 *     and hold difficulty. Advancing here would compound the gap.
 *  2. **Sign error** — serve a split whose acceleration is *pinned negative*
 *     (`conditions`), the one case where a targeted problem can be constructed
 *     rather than waited for.
 *  3. **Execution slip** (`unit-slip`, `arithmetic-slip`, `value-slip`) — the
 *     concept held; same shape, fresh numbers.
 *  4. **Clean solve** — step the difficulty band, and once `hard` is solved
 *     clean, rotate to a different relation.
 */

export type RemediationKind =
  | "consolidate"
  | "repeat-split"
  | "sign-drill"
  | "same-shape"
  | "advance"
  | "new-split"

export type NextProblemPlan = {
  kind: RemediationKind
  /** Constraints handed straight to `generateCoachProblem`. */
  params: {
    given?: string[]
    find?: string
    difficulty: CoachDifficulty
    conditions?: Record<string, number>
  }
  /** Thai one-liner shown on the "ฝึกต่อ" button, so the choice is explained. */
  reason: string
}

/** Errors that mean the student has not grasped the *shape* of the problem. */
const CONCEPTUAL_ERRORS: readonly CoachErrorType[] = ["wrong-equation", "swapped-variables"]

/**
 * Accelerations the sign drill pins, in m/s².
 *
 * Not arbitrary: 2–5 m/s² is the everyday braking range for a road vehicle, so
 * a drill problem reads like something real slowing down rather than a number
 * chosen to be awkward. Negative throughout, because the whole point is that a
 * quantity opposing the positive direction carries a sign. Cycled by problem
 * index so a student who keeps slipping meets a different deceleration each
 * time instead of memorizing one answer.
 */
export const SIGN_DRILL_ACCELERATIONS = [-2, -3, -4, -5] as const

/**
 * How many times a misconception must appear in the recent history before it
 * counts as *persistent* — i.e. one clean solve is not evidence it is fixed.
 */
const PERSISTENCE_THRESHOLD = 3

const HARDER: Record<CoachDifficulty, CoachDifficulty> = {
  easy: "medium",
  medium: "hard",
  hard: "hard",
}

/**
 * A relation's canonical split: solve for its first variable, give the rest.
 * `relationForSplit` is order-insensitive, so this always round-trips.
 */
function splitFor(relation: SuvatRelation): { given: string[]; find: string } {
  const [find, ...given] = relation.variables
  return { given: [...given], find }
}

/**
 * The relation the sign drill targets: the first in the bank whose canonical
 * split *gives* acceleration, so `conditions: {a}` can actually pin it. Derived
 * rather than hardcoded, so editing the relation bank cannot silently leave the
 * drill pinning a variable the split does not contain.
 */
function signDrillRelation(): SuvatRelation {
  const found = SUVAT_RELATIONS.find((rel) => splitFor(rel).given.includes("a"))
  return found ?? SUVAT_RELATIONS[0]
}

/** The misconception seen at least {@link PERSISTENCE_THRESHOLD} times, if any. */
function persistentError(
  history: readonly CoachErrorType[]
): CoachErrorType | null {
  const counts = new Map<CoachErrorType, number>()
  for (const error of history) {
    counts.set(error, (counts.get(error) ?? 0) + 1)
  }
  for (const [error, count] of counts) {
    if (count >= PERSISTENCE_THRESHOLD) return error
  }
  return null
}

export function planNextProblem(input: {
  /** Error types recorded while solving the problem just finished, in order. */
  errors: readonly CoachErrorType[]
  /** The finished problem's Given names… */
  given: readonly string[]
  /** …and its Find name. */
  find: string
  /** The band that problem was generated at. */
  difficulty: CoachDifficulty
  /** Problems completed this session — drives the deterministic rotations. */
  completed: number
  /**
   * Misconceptions from earlier problems (this session, or the student's
   * persisted `coaching_attempts`). Consulted only when the problem just
   * finished was clean: a fresh diagnosis is better evidence than a trend, but
   * one clean solve is not proof that a recurring gap is closed.
   */
  history?: readonly CoachErrorType[]
}): NextProblemPlan {
  const { errors, difficulty, completed } = input
  const sameSplit = { given: [...input.given], find: input.find }

  const conceptual = errors.some((error) => CONCEPTUAL_ERRORS.includes(error))
  if (conceptual) {
    return {
      kind: "repeat-split",
      params: { ...sameSplit, difficulty },
      reason: "ทบทวนโจทย์รูปแบบเดิมอีกครั้ง — ตัวเลขใหม่ สมการเดิม",
    }
  }

  if (errors.includes("sign-error")) {
    const drillSplit = splitFor(signDrillRelation())
    const acceleration =
      SIGN_DRILL_ACCELERATIONS[completed % SIGN_DRILL_ACCELERATIONS.length]
    return {
      kind: "sign-drill",
      params: {
        ...drillSplit,
        difficulty,
        // Only ever pin a variable the split actually gives.
        ...(drillSplit.given.includes("a") ? { conditions: { a: acceleration } } : {}),
      },
      reason: "ฝึกเรื่องเครื่องหมาย — โจทย์ที่มีความเร่งเป็นลบ (การชะลอตัว)",
    }
  }

  if (errors.length > 0) {
    return {
      kind: "same-shape",
      params: { ...sameSplit, difficulty },
      reason: "ฝึกความแม่นยำ — โจทย์รูปแบบเดิม ตัวเลขใหม่",
    }
  }

  // Clean solve — but check the trend before rewarding it. A misconception the
  // student keeps returning to is not fixed by one good problem, and advancing
  // the band on top of an unresolved gap is how a student ends up stuck.
  const persistent = persistentError(input.history ?? [])
  if (persistent === "sign-error") {
    const drillSplit = splitFor(signDrillRelation())
    const acceleration =
      SIGN_DRILL_ACCELERATIONS[completed % SIGN_DRILL_ACCELERATIONS.length]
    return {
      kind: "sign-drill",
      params: {
        ...drillSplit,
        difficulty,
        ...(drillSplit.given.includes("a") ? { conditions: { a: acceleration } } : {}),
      },
      reason: "ยังพลาดเรื่องเครื่องหมายอยู่บ่อย — ฝึกโจทย์ความเร่งเป็นลบอีกสักข้อ",
    }
  }
  if (persistent) {
    return {
      kind: "consolidate",
      params: { ...sameSplit, difficulty },
      reason: "ทำได้แล้ว แต่ยังพลาดจุดเดิมบ่อย — ย้ำอีกข้อที่ระดับเดิมก่อนขยับ",
    }
  }

  if (difficulty !== "hard") {
    return {
      kind: "advance",
      params: { ...sameSplit, difficulty: HARDER[difficulty] },
      reason: "ทำได้ดีมาก — ลองระดับที่ยากขึ้น",
    }
  }

  // Mastered this shape at the hardest band: rotate to a relation the student
  // has not just been drilled on, and drop a band so a new shape starts fair.
  const current = relationForSplit(input.given, input.find)
  const currentIndex = current
    ? SUVAT_RELATIONS.findIndex((rel) => rel.id === current.id)
    : -1
  const nextIndex = (currentIndex + 1 + completed) % SUVAT_RELATIONS.length
  const relation =
    SUVAT_RELATIONS[nextIndex].id === current?.id
      ? SUVAT_RELATIONS[(nextIndex + 1) % SUVAT_RELATIONS.length]
      : SUVAT_RELATIONS[nextIndex]

  return {
    kind: "new-split",
    params: { ...splitFor(relation), difficulty: "medium" },
    reason: "เชี่ยวชาญรูปแบบนี้แล้ว — ลองสมการรูปแบบใหม่",
  }
}

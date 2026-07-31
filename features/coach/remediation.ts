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
 * Accelerations the sign drill pins. Cycled by problem index so a student who
 * keeps slipping on signs meets a different deceleration each time rather than
 * memorizing one number.
 */
export const SIGN_DRILL_ACCELERATIONS = [-2, -3, -4, -5] as const

/** The `v = u + at` split — the sign drill's target, always coachable. */
const SIGN_DRILL_RELATION_ID = "v-uat"

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
    const relation =
      SUVAT_RELATIONS.find((rel) => rel.id === SIGN_DRILL_RELATION_ID) ?? SUVAT_RELATIONS[0]
    const drillSplit = splitFor(relation)
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

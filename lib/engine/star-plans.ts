/**
 * The star-difficulty planner, ported from the jotelab-sandbox testbench
 * (approved 2026-07-30).
 *
 * Stars measure *structural* difficulty — how the student must think — while
 * the engine's easy/medium/hard stays a separate numbers knob. Each star owns
 * a pool of concrete plans built from what the engine can already do:
 *
 *   1★ direct        — one formula, natural direction (forward splits)
 *   2★ sequential    — an intermediate value must be found first, or the
 *                      formula must be genuinely rearranged
 *   3★ hidden        — a given arrives as a worded event, not a number; the
 *                      planner pins it via `conditions` (v = 0 at the top,
 *                      u = 0 for "dropped") and the phrasing step renders the
 *                      phrase instead of the value
 *   4★ compound      — simultaneous systems (meets, multi-phase) and
 *                      working-backwards solves
 *   5★ cross-topic   — chained multi-part problems; the plans are carried
 *                      here for completeness but are NOT selectable for
 *                      worksheet generation yet: the persisted question format
 *                      is single-part (see docs/playful-design.md, follow-ups)
 *
 * The ladder is cumulative — each star retains the mechanics of the stars
 * below it. Worksheets pick a plan per question order (seeded, so a
 * worksheet's structure is stable across reloads), filtered by the question's
 * engine topic; a topic with no plan at the requested star falls back to the
 * nearest lower star that has one, and to a plain engine call below 1★.
 */

export type StarDifficulty = 1 | 2 | 3 | 4 | 5

/** A given implied in words, not stated as a number. `part` scopes it to one chain part. */
export type HiddenGiven = { symbol: string; phrase: string; part?: number }

type PlanBase = {
  title: string
  note: string
  /** The lower-star mechanics this plan retains; defaults to the star's ladder line. */
  layers?: string
  hidden?: HiddenGiven[]
  /** Events baked into the template itself (a pursuit's meet, a burnout) — worded, not symbols. */
  implicit?: string[]
}

export type SingleStarPlan = PlanBase & {
  kind: "single"
  topic: string
  given: string[]
  find: string
  conditions?: Record<string, number>
}

export type ChainStarPlan = PlanBase & {
  kind: "chain"
  parts: {
    topic: string
    given?: string[]
    find?: string
    receive?: string
    conditions?: Record<string, number>
  }[]
}

export type StarPlan = SingleStarPlan | ChainStarPlan

export const STAR_PLANS: Record<StarDifficulty, StarPlan[]> = {
  1: [
    {
      kind: "single",
      title: "Final velocity, one formula",
      note: "v = u + at in its natural direction — read, substitute, solve.",
      topic: "suvat",
      given: ["u", "a", "t"],
      find: "v",
    },
    {
      kind: "single",
      title: "Velocity from displacement and time",
      note: "v = s/t directly.",
      topic: "vectors-1d",
      given: ["s", "t"],
      find: "v",
    },
    {
      kind: "single",
      title: "Net displacement of a two-leg walk",
      note: "Signed addition, one definition.",
      topic: "distance-displacement",
      given: ["d1", "d2"],
      find: "disp",
    },
    {
      kind: "single",
      title: "Average speed of a trip",
      note: "Total path over total time, one definition.",
      topic: "average-speed",
      given: ["d1", "d2", "t"],
      find: "sp",
    },
    {
      kind: "single",
      title: "Speed after falling for t seconds",
      note: "v = u + gt directly.",
      topic: "free-fall",
      given: ["u", "g", "t"],
      find: "v",
    },
    {
      kind: "single",
      title: "Relative velocity of two bodies",
      note: "v_AB = v_A − v_B, one definition.",
      topic: "relative-velocity",
      given: ["va", "vb"],
      find: "vab",
    },
  ],
  2: [
    {
      kind: "single",
      title: "Two-phase trip: total displacement",
      note: "The cruise velocity must be computed from phase 1 before phase 2's distance exists — formula B feeds formula A.",
      topic: "multi-stage-motion",
      given: ["u", "a", "t1", "t2"],
      find: "s",
    },
    {
      kind: "single",
      title: "Two-phase trip: recover the cruise velocity",
      note: "The total displacement mixes both phases; isolating v needs the phase-1 relation inside the total.",
      topic: "multi-stage-motion",
      given: ["s", "u", "t1", "t2"],
      find: "v",
    },
    {
      kind: "single",
      title: "Displacement as area under a v–t graph",
      note: "Read the polyline, build the area in two pieces, then sum — sequential use of two relations.",
      topic: "motion-graphs",
      given: ["u", "a", "t1", "t2"],
      find: "s",
    },
    {
      kind: "single",
      title: "Time from the displacement equation",
      note: "s = ut + at²/2 solved for t — a genuine quadratic rearrangement, then root selection.",
      topic: "suvat",
      given: ["u", "a", "s"],
      find: "t",
    },
  ],
  3: [
    {
      kind: "single",
      title: "Time to the highest point",
      note: "\"Reaches its highest point\" is the hidden equation v = 0 — no number for v appears in the problem.",
      topic: "upward-throw",
      given: ["u", "v", "g"],
      find: "t",
      conditions: { v: 0 },
      hidden: [{ symbol: "v", phrase: "reaches its highest point (v = 0, implied)" }],
    },
    {
      kind: "single",
      title: "Maximum height of a throw",
      note: "Same hidden condition, different unknown: at the top, v = 0.",
      topic: "upward-throw",
      given: ["u", "v", "g"],
      find: "h",
      conditions: { v: 0 },
      hidden: [{ symbol: "v", phrase: "reaches its highest point (v = 0, implied)" }],
    },
    {
      kind: "single",
      title: "Dropped object: distance fallen",
      note: "\"Dropped\" (not thrown) is the hidden given u = 0.",
      topic: "free-fall",
      given: ["u", "g", "t"],
      find: "h",
      conditions: { u: 0 },
      hidden: [{ symbol: "u", phrase: "dropped from rest (u = 0, implied)" }],
    },
    {
      kind: "single",
      title: "Impact speed from a drop height",
      note: "Hidden u = 0 plus the no-time route v² = 2gh.",
      topic: "free-fall",
      given: ["u", "g", "h"],
      find: "v",
      conditions: { u: 0 },
      hidden: [{ symbol: "u", phrase: "dropped from rest (u = 0, implied)" }],
    },
    {
      kind: "single",
      title: "Braking distance to a stop",
      note: "\"Comes to rest\" is the hidden equation v = 0.",
      topic: "suvat",
      given: ["u", "v", "t"],
      find: "s",
      conditions: { v: 0 },
      hidden: [{ symbol: "v", phrase: "brakes until it stops (v = 0, implied)" }],
    },
  ],
  4: [
    {
      kind: "single",
      title: "Pursuit: when do they meet?",
      note: "Two position equations solved simultaneously — the meet is the coupling.",
      topic: "pursuit",
      given: ["gap", "a", "v"],
      find: "t",
      implicit: ['"catches up" means equal positions — x_chaser = x_leader (implied)'],
    },
    {
      kind: "single",
      title: "Pursuit: recover the head start",
      note: "Working backwards through the same system — the catch-up is known, the initial gap is not.",
      topic: "pursuit",
      given: ["a", "t", "v"],
      find: "gap",
      implicit: ['"catches up" means equal positions — x_chaser = x_leader (implied)'],
    },
    {
      kind: "single",
      title: "Rocket: peak height of a two-phase ascent",
      note: "Powered phase feeds the coast phase; the burn-out state is solved inside the system.",
      topic: "two-phase-ascent",
      given: ["a", "g", "t1"],
      find: "H",
      implicit: ["after burnout it coasts until it momentarily stops — v = 0 at the peak (implied)"],
    },
    {
      kind: "single",
      title: "Rocket: recover the engine acceleration",
      note: "Working backwards — the peak height is given, the engine's acceleration must be recovered through both phases.",
      topic: "two-phase-ascent",
      given: ["H", "g", "t1"],
      find: "a",
      implicit: ["after burnout it coasts until it momentarily stops — v = 0 at the peak (implied)"],
    },
    {
      kind: "single",
      title: "Rocket: recover the burn time",
      note: "Working backwards to an earlier quantity through the whole system.",
      topic: "two-phase-ascent",
      given: ["H", "a", "g"],
      find: "t1",
      implicit: ["after burnout it coasts until it momentarily stops — v = 0 at the peak (implied)"],
    },
  ],
  5: [
    {
      kind: "chain",
      title: "Dropped, then skids to a stop",
      note: "Every layer at once: a hidden u = 0 (dropped), a hidden v = 0 (skids to rest), and the impact speed carried exactly across the topic boundary.",
      parts: [
        { topic: "free-fall", given: ["u", "g", "t"], find: "v", conditions: { u: 0 } },
        { topic: "suvat", given: ["u", "v", "t"], find: "s", receive: "u", conditions: { v: 0 } },
      ],
      hidden: [
        { part: 0, symbol: "u", phrase: "dropped from rest (u = 0, implied)" },
        { part: 1, symbol: "v", phrase: "skids until it stops (v = 0, implied)" },
      ],
    },
    {
      kind: "chain",
      title: "Launched from rest, then time to the top",
      note: "The launcher starts from rest (hidden u = 0); the muzzle speed feeds an upward throw asked at its highest point (hidden v = 0).",
      parts: [
        { topic: "suvat", given: ["u", "a", "t"], find: "v", conditions: { u: 0 } },
        { topic: "upward-throw", given: ["u", "v", "g"], find: "t", receive: "u", conditions: { v: 0 } },
      ],
      hidden: [
        { part: 0, symbol: "u", phrase: "starts from rest (u = 0, implied)" },
        { part: 1, symbol: "v", phrase: "rises to its highest point (v = 0, implied)" },
      ],
    },
    {
      kind: "chain",
      title: "Fall, accelerate, then rise (3 parts)",
      note: "Three topics in one problem: a drop's impact speed feeds a straight-line acceleration, whose exit speed feeds an upward throw asked at its peak.",
      parts: [
        { topic: "free-fall", given: ["u", "g", "t"], find: "v", conditions: { u: 0 } },
        { topic: "suvat", given: ["u", "a", "t"], find: "v", receive: "u" },
        { topic: "upward-throw", given: ["u", "v", "g"], find: "h", receive: "u", conditions: { v: 0 } },
      ],
      hidden: [
        { part: 0, symbol: "u", phrase: "dropped from rest (u = 0, implied)" },
        { part: 2, symbol: "v", phrase: "rises to its highest point (v = 0, implied)" },
      ],
    },
  ],
}

/**
 * The per-star statement of retained layers (the ladder is cumulative); shown
 * with the star control and usable in docs/UI copy.
 */
export const STAR_LAYERS: Record<StarDifficulty, string> = {
  1: "direct",
  2: "direct + sequential",
  3: "direct + sequential + hidden condition",
  4: "direct + sequential + hidden events + simultaneous / working backwards",
  5: "direct + sequential + hidden conditions + chained coupling + cross-topic",
}

/**
 * The highest star worksheet generation supports today: 5★ plans are chained
 * multi-part problems, which the single-part persisted question format cannot
 * represent yet.
 */
export const MAX_GENERATABLE_STARS = 4

/**
 * Pick the plan for one question: the seeded entry of the requested star's
 * pool filtered to this engine topic, walking down a star at a time when the
 * topic has no plan at that level (the ladder is cumulative, so a lower star
 * on the same topic is the honest nearest structure). Returns `null` when no
 * star on the ladder has a single-part plan for the topic — the caller then
 * generates a plain engine problem.
 */
export function pickStarPlan(
  stars: StarDifficulty,
  topic: string,
  seed: number
): { plan: SingleStarPlan; stars: StarDifficulty } | null {
  const startAt = Math.min(stars, MAX_GENERATABLE_STARS) as StarDifficulty
  for (let level = startAt; level >= 1; level -= 1) {
    const pool = STAR_PLANS[level as StarDifficulty].filter(
      (plan): plan is SingleStarPlan => plan.kind === "single" && plan.topic === topic
    )
    if (pool.length > 0) {
      return {
        plan: pool[Math.abs(seed) % pool.length],
        stars: level as StarDifficulty,
      }
    }
  }
  return null
}

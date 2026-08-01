import { describe, expect, it } from "vitest"

import {
  MAX_GENERATABLE_STARS,
  STAR_PLANS,
  pickStarPlan,
  type StarDifficulty,
} from "./star-plans"

describe("STAR_PLANS pool", () => {
  it("holds only single-part plans below 5★ and only chains at 5★", () => {
    for (const level of [1, 2, 3, 4] as const) {
      for (const plan of STAR_PLANS[level]) {
        expect(plan.kind).toBe("single")
      }
    }
    for (const plan of STAR_PLANS[5]) {
      expect(plan.kind).toBe("chain")
    }
  })

  it("pins every 3★ hidden condition to zero (the fidelity gate's exemption)", () => {
    for (const plan of STAR_PLANS[3]) {
      if (plan.kind !== "single" || !plan.conditions) continue
      for (const value of Object.values(plan.conditions)) {
        expect(value).toBe(0)
      }
      // Every pinned symbol has a phrase for the phrasing prompt.
      const hiddenSymbols = (plan.hidden ?? []).map((hidden) => hidden.symbol)
      expect(hiddenSymbols).toEqual(Object.keys(plan.conditions))
    }
  })
})

describe("pickStarPlan", () => {
  it("picks a plan of the requested star for a covered topic", () => {
    const picked = pickStarPlan(3, "upward-throw", 0)
    expect(picked).not.toBeNull()
    expect(picked?.stars).toBe(3)
    expect(picked?.plan.topic).toBe("upward-throw")
  })

  it("cycles the pool by seed", () => {
    const first = pickStarPlan(3, "free-fall", 0)
    const second = pickStarPlan(3, "free-fall", 1)
    const wrapped = pickStarPlan(3, "free-fall", 2)
    expect(first?.plan.title).not.toBe(second?.plan.title)
    expect(wrapped?.plan.title).toBe(first?.plan.title)
  })

  it("walks down to the nearest star with a plan for the topic", () => {
    // vectors-1d only has a 1★ plan; asking for 3★ lands on it.
    const picked = pickStarPlan(3, "vectors-1d", 0)
    expect(picked?.stars).toBe(1)
    expect(picked?.plan.topic).toBe("vectors-1d")
  })

  it("caps 5★ requests at the generatable maximum", () => {
    const picked = pickStarPlan(5, "pursuit", 0)
    expect(picked).not.toBeNull()
    expect(picked?.stars).toBeLessThanOrEqual(MAX_GENERATABLE_STARS)
  })

  it("returns null for a topic no star covers", () => {
    expect(pickStarPlan(4, "electrostatics", 0)).toBeNull()
  })

  it("is deterministic for a star + topic + seed triple", () => {
    for (const stars of [1, 2, 3, 4] as StarDifficulty[]) {
      const a = pickStarPlan(stars, "suvat", 7)
      const b = pickStarPlan(stars, "suvat", 7)
      expect(a?.plan.title).toBe(b?.plan.title)
    }
  })
})

import { describe, expect, it } from "vitest"

import {
  getCompatibleGivenIds,
  getFindPool,
  getIncompatibleGivenIds,
  shouldShowGivenSection,
} from "./variable-compatibility"

describe("getFindPool", () => {
  it("returns selected find ids scoped to lesson", () => {
    expect(getFindPool("motion-1d", ["phys-v", "phys-q"], false)).toEqual(["phys-v"])
  })

  it("returns all lesson vars when random with no selection", () => {
    const pool = getFindPool("motion-1d", [], true)
    expect(pool).toHaveLength(5)
  })

  it("returns empty when no selection and not random", () => {
    expect(getFindPool("motion-1d", [], false)).toEqual([])
  })
})

describe("getCompatibleGivenIds", () => {
  it("returns kinematic givens for finding final velocity", () => {
    const compatible = getCompatibleGivenIds("motion-1d", ["phys-v"], false)
    expect(compatible).toEqual(expect.arrayContaining(["phys-v0", "phys-a", "phys-t", "phys-s"]))
    expect(compatible).not.toContain("phys-v")
  })

  it("returns all lesson vars when random with no find selection", () => {
    expect(getCompatibleGivenIds("motion-1d", [], true)).toHaveLength(5)
  })

  it("returns empty when no find and not random", () => {
    expect(getCompatibleGivenIds("motion-1d", [], false)).toEqual([])
  })
})

describe("getIncompatibleGivenIds", () => {
  it("excludes compatible and find ids", () => {
    const incompatible = getIncompatibleGivenIds("motion-1d", ["phys-v"], false)
    expect(incompatible).not.toContain("phys-v0")
    expect(incompatible).not.toContain("phys-v")
  })
})

describe("shouldShowGivenSection", () => {
  it("is false without find or random", () => {
    expect(shouldShowGivenSection([], false)).toBe(false)
  })

  it("is true with find selection", () => {
    expect(shouldShowGivenSection(["phys-v"], false)).toBe(true)
  })

  it("is true with random enabled", () => {
    expect(shouldShowGivenSection([], true)).toBe(true)
  })
})

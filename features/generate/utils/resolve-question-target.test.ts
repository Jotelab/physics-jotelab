import { describe, expect, it } from "vitest"

import { generationSettingsSchema } from "@/features/generate/schemas"

import {
  getTargetPoolFromSettings,
  resolveQuestionTarget,
} from "./resolve-question-target"

const baseSettings = {
  lesson: "Motion in one dimension",
  scenario: "Find final velocity.",
}

describe("getTargetPoolFromSettings", () => {
  it("uses explicit target variables when present", () => {
    const settings = generationSettingsSchema.parse({
      ...baseSettings,
      target_variables: [
        { symbol: "v", label: "final velocity", unit: "m/s" },
        { symbol: "a", label: "acceleration", unit: "m/s²" },
      ],
    })

    expect(getTargetPoolFromSettings(settings)).toHaveLength(2)
  })

  it("builds lesson pool when random is enabled without explicit targets", () => {
    const settings = generationSettingsSchema.parse({
      lesson: "motion-1d",
      scenario: "Kinematics.",
      target_randomize: true,
    })

    expect(getTargetPoolFromSettings(settings).length).toBeGreaterThan(0)
  })
})

describe("resolveQuestionTarget", () => {
  it("rotates targets by question order", () => {
    const settings = generationSettingsSchema.parse({
      ...baseSettings,
      target_variables: [
        { symbol: "v", label: "final velocity" },
        { symbol: "a", label: "acceleration" },
      ],
    })

    expect(resolveQuestionTarget(settings, 1, "ws-1")?.symbol).toBe("v")
    expect(resolveQuestionTarget(settings, 2, "ws-1")?.symbol).toBe("a")
    expect(resolveQuestionTarget(settings, 3, "ws-1")?.symbol).toBe("v")
  })

  it("picks deterministically when random is enabled", () => {
    const settings = generationSettingsSchema.parse({
      ...baseSettings,
      target_variables: [
        { symbol: "v", label: "final velocity" },
        { symbol: "a", label: "acceleration" },
        { symbol: "t", label: "time" },
      ],
      target_randomize: true,
    })

    const first = resolveQuestionTarget(settings, 1, "ws-abc")
    const second = resolveQuestionTarget(settings, 1, "ws-abc")
    const otherOrder = resolveQuestionTarget(settings, 2, "ws-abc")

    expect(first?.symbol).toBe(second?.symbol)
    expect(first?.symbol).not.toBe(otherOrder?.symbol)
  })
})

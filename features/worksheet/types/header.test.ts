import { describe, expect, it } from "vitest"

import { MAX_HEADER_INSTRUCTIONS_LEN, MAX_HEADER_TITLE_LEN } from "@/features/generate/limits"
import { worksheetHeaderConfigSchema } from "@/features/generate/schemas"

import {
  DEFAULT_HEADER_FIELDS,
  mergeHeaderFields,
  resolveHeaderConfig,
  toPersistedHeaderConfig,
} from "./header"

describe("resolveHeaderConfig", () => {
  it("uses defaults when saved header is empty", () => {
    expect(
      resolveHeaderConfig(null, {
        title: "Physics: Motion",
        instructions: "5 questions - Find velocity.",
      })
    ).toEqual({
      title: "Physics: Motion",
      instructions: "5 questions - Find velocity.",
      fields: DEFAULT_HEADER_FIELDS,
    })
  })

  it("applies saved overrides", () => {
    expect(
      resolveHeaderConfig(
        {
          title: "Custom Title",
          instructions: "Read carefully.",
          fields: { showStudentName: false, showDate: true, showClassSection: true, showScoreBox: true },
        },
        {
          title: "Physics: Motion",
          instructions: "5 questions - Find velocity.",
        }
      )
    ).toEqual({
      title: "Custom Title",
      instructions: "Read carefully.",
      fields: {
        showStudentName: false,
        showDate: true,
        showClassSection: true,
        showScoreBox: true,
      },
    })
  })

  it("ignores whitespace-only saved strings", () => {
    expect(
      resolveHeaderConfig(
        { title: "   ", instructions: "\n" },
        {
          title: "Physics: Motion",
          instructions: "5 questions - Find velocity.",
        }
      )
    ).toEqual({
      title: "Physics: Motion",
      instructions: "5 questions - Find velocity.",
      fields: DEFAULT_HEADER_FIELDS,
    })
  })
})

describe("toPersistedHeaderConfig", () => {
  it("omits title and instructions when they match defaults", () => {
    expect(
      toPersistedHeaderConfig(
        {
          title: "Physics: Motion",
          instructions: "5 questions - Find velocity.",
          fields: DEFAULT_HEADER_FIELDS,
        },
        {
          title: "Physics: Motion",
          instructions: "5 questions - Find velocity.",
        }
      )
    ).toEqual({
      fields: DEFAULT_HEADER_FIELDS,
    })
  })

  it("includes title and instructions when they differ from defaults", () => {
    expect(
      toPersistedHeaderConfig(
        {
          title: "Quiz 1",
          instructions: "Read carefully.",
          fields: DEFAULT_HEADER_FIELDS,
        },
        {
          title: "Physics: Motion",
          instructions: "5 questions - Find velocity.",
        }
      )
    ).toEqual({
      title: "Quiz 1",
      instructions: "Read carefully.",
      fields: DEFAULT_HEADER_FIELDS,
    })
  })
})

describe("mergeHeaderFields", () => {
  it("fills missing toggles with defaults", () => {
    expect(mergeHeaderFields({ showScoreBox: true })).toEqual({
      ...DEFAULT_HEADER_FIELDS,
      showScoreBox: true,
    })
  })
})

describe("worksheetHeaderConfigSchema", () => {
  it("accepts valid header config", () => {
    expect(
      worksheetHeaderConfigSchema.safeParse({
        title: "Quiz 1",
        instructions: "Show your work.",
        fields: DEFAULT_HEADER_FIELDS,
      }).success
    ).toBe(true)
  })

  it("rejects oversized title and instructions", () => {
    expect(
      worksheetHeaderConfigSchema.safeParse({
        title: "x".repeat(MAX_HEADER_TITLE_LEN + 1),
      }).success
    ).toBe(false)
    expect(
      worksheetHeaderConfigSchema.safeParse({
        instructions: "x".repeat(MAX_HEADER_INSTRUCTIONS_LEN + 1),
      }).success
    ).toBe(false)
  })
})

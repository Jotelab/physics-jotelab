import { describe, expect, it } from "vitest"

import { SUBJECT_CONTENT_PACKS } from "@/features/generate/data/subject-content-packs"
import { allRegisteredEngineTopics } from "@/lib/engine/topics"
import sympyDataContractFixture from "@/tests/fixtures/sympy-data-contract.json"

import { sympyDataSchema } from "@/lib/engine/sympy-data"

import { buildTemplateTikz, topicsWithDiagramDecision } from "./index"

describe("diagram template registry", () => {
  it("has an explicit decision for every engine topic any content pack declares", () => {
    const declared = allRegisteredEngineTopics(Object.values(SUBJECT_CONTENT_PACKS))
    const decided = topicsWithDiagramDecision()

    const undecided = [...declared.keys()].filter((topic) => !decided.has(topic))

    expect(
      undecided,
      `Engine topic(s) ${undecided.join(", ")} are declared by a content pack but have ` +
        `neither a TikZ template nor an entry in TOPICS_WITHOUT_DIAGRAMS. ` +
        `Register a builder in TEMPLATE_BUILDERS, or record the decision to ship ` +
        `without a diagram.`
    ).toEqual([])
  })

  it("does not keep templates for topics no pack declares", () => {
    const declared = allRegisteredEngineTopics(Object.values(SUBJECT_CONTENT_PACKS))
    const orphaned = [...topicsWithDiagramDecision()].filter(
      (topic) => !declared.has(topic)
    )

    expect(
      orphaned,
      `Diagram decision(s) for ${orphaned.join(", ")} refer to engine topics no ` +
        `content pack declares — the topic was renamed or removed.`
    ).toEqual([])
  })

  it("builds TikZ for a registered topic and null for an unknown one", () => {
    const sympyData = sympyDataSchema.parse(sympyDataContractFixture)

    expect(buildTemplateTikz(sympyData)).toContain("\\begin{tikzpicture}")
    expect(buildTemplateTikz({ ...sympyData, topic: "not-a-topic" })).toBeNull()
  })
})

import { describe, expect, it } from "vitest"

import { engineNameForDisplaySymbol, resolveEngineTopic } from "@/lib/engine/topics"

import { PHYSICS_LESSON_IDS, physicsContentPack } from "./physics"

const pack = physicsContentPack

describe("physics content pack consistency", () => {
  const presetIds = new Set(pack.variablePresets.map((preset) => preset.id))

  it("has a label and scenarios for every lesson", () => {
    for (const lessonId of PHYSICS_LESSON_IDS) {
      expect(pack.lessonLabelsEn[lessonId], lessonId).toBeTruthy()
      expect(pack.scenarioContent[lessonId]?.length, lessonId).toBeGreaterThan(0)
    }
  })

  it("only references declared variable presets", () => {
    for (const [lessonId, variableIds] of Object.entries(pack.variableIdsByLesson)) {
      for (const id of variableIds) {
        expect(presetIds.has(id), `${lessonId}: ${id}`).toBe(true)
      }
    }
  })

  it("keeps given candidates within each lesson's variables", () => {
    for (const [lessonId, byFind] of Object.entries(pack.givenCandidatesByLessonAndFind)) {
      const lessonVars = new Set(pack.variableIdsByLesson[lessonId])
      for (const [findId, givenIds] of Object.entries(byFind)) {
        expect(lessonVars.has(findId), `${lessonId}: find ${findId}`).toBe(true)
        for (const givenId of givenIds) {
          expect(lessonVars.has(givenId), `${lessonId}: ${findId} → ${givenId}`).toBe(true)
          expect(givenId, `${lessonId}: ${findId} lists itself as a given`).not.toBe(findId)
        }
      }
    }
  })

  it("maps every engine-backed lesson variable onto its engine topic", () => {
    // Advanced-mode pins translate pack display symbols to engine names via
    // engineNameForDisplaySymbol; a symbol the topic does not know would make
    // that pin silently drop, so every lesson variable must resolve.
    const presetById = new Map(pack.variablePresets.map((preset) => [preset.id, preset]))
    for (const lessonId of PHYSICS_LESSON_IDS) {
      const topic = resolveEngineTopic(lessonId, "physics")
      if (!topic) continue
      const symbols = new Set<string>()
      for (const variableId of pack.variableIdsByLesson[lessonId]) {
        const preset = presetById.get(variableId)
        expect(preset, `${lessonId}: ${variableId}`).toBeTruthy()
        if (!preset) continue
        expect(symbols.has(preset.symbol), `${lessonId}: duplicate symbol ${preset.symbol}`).toBe(
          false
        )
        symbols.add(preset.symbol)
        expect(
          engineNameForDisplaySymbol(topic, preset.symbol),
          `${lessonId}: ${variableId} (${preset.symbol}) is unknown to topic ${topic.topic}`
        ).toBeTruthy()
      }
    }
  })
})

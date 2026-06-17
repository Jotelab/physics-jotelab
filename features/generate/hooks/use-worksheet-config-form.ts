"use client"

import { useState } from "react"

import {
  getLessonLabel,
  getScenariosForLesson,
  getScenarioDescription,
  pruneVariableSelection,
  resolveLessonKey,
  toVariableRows,
} from "@/features/generate/data/generation-presets"
import { generateWorksheetInputSchema } from "@/features/generate/schemas"
import {
  mapGivenRowsToVariables,
  mapTargetRowsToVariables,
} from "@/features/generate/utils/map-variable-rows"

export function buildGenerateWorksheetInput(params: {
  lesson: string
  scenarioDescription: string
  resolvedScenarioId: string
  effectiveQuestionCount: number
  givenVariableIds: string[]
  targetVariableId: string
}) {
  const lessonKey = resolveLessonKey(params.lesson)
  const resolvedLesson =
    lessonKey.isPreset && lessonKey.lessonId
      ? getLessonLabel(lessonKey.lessonId)
      : params.lesson.trim()

  const scenario =
    params.scenarioDescription ||
    getScenarioDescription(params.lesson, params.resolvedScenarioId) ||
    ""

  const variablePayload =
    params.givenVariableIds.length > 0 || params.targetVariableId
      ? (() => {
          const { given, target } = toVariableRows(
            params.givenVariableIds,
            params.targetVariableId
          )
          return {
            given_variables: given.length > 0 ? mapGivenRowsToVariables(given) : undefined,
            target_variables: target.length > 0 ? mapTargetRowsToVariables(target) : undefined,
          }
        })()
      : {}

  return generateWorksheetInputSchema.safeParse({
    subject: "physics",
    lesson: resolvedLesson,
    scenario,
    question_count: params.effectiveQuestionCount,
    ...variablePayload,
  })
}

export function useWorksheetConfigForm() {
  const [lesson, setLesson] = useState("")
  const [scenarioId, setScenarioId] = useState("")
  const [scenarioDescription, setScenarioDescription] = useState("")
  const [questionCount, setQuestionCount] = useState(10)

  const [activeTab, setActiveTab] = useState<"basic" | "advanced">("basic")
  const [givenVariableIds, setGivenVariableIds] = useState<string[]>([])
  const [targetVariableId, setTargetVariableId] = useState("")

  const trimmedLesson = lesson.trim()
  const lessonScenarios =
    trimmedLesson ? getScenariosForLesson(trimmedLesson).scenarios : []
  const resolvedScenarioId = lessonScenarios.some((s) => s.id === scenarioId) ? scenarioId : ""
  const hasRequiredFields = Boolean(trimmedLesson && resolvedScenarioId)

  function applyVariablePruning(nextLesson: string) {
    const pruned = pruneVariableSelection(nextLesson, givenVariableIds, targetVariableId)
    setGivenVariableIds(pruned.givenVariableIds)
    setTargetVariableId(pruned.targetVariableId)
  }

  function handleLessonChange(newLesson: string) {
    setLesson(newLesson)
    applyVariablePruning(newLesson)
  }

  function handleLessonSuggestionSelect() {
    setScenarioId("")
    setScenarioDescription("")
  }

  function handleScenarioChange(id: string, description: string) {
    setScenarioId(id)
    setScenarioDescription(description)
  }

  return {
    lesson,
    scenarioDescription,
    resolvedScenarioId,
    questionCount,
    setQuestionCount,
    activeTab,
    setActiveTab,
    givenVariableIds,
    setGivenVariableIds,
    targetVariableId,
    setTargetVariableId,
    trimmedLesson,
    hasRequiredFields,
    handleLessonChange,
    handleLessonSuggestionSelect,
    handleScenarioChange,
    buildInput: (effectiveQuestionCount: number) =>
      buildGenerateWorksheetInput({
        lesson,
        scenarioDescription,
        resolvedScenarioId,
        effectiveQuestionCount,
        givenVariableIds,
        targetVariableId,
      }),
  }
}

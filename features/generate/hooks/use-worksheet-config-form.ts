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
import {
  DEFAULT_CONCEPTUAL_DIFFICULTY,
  DEFAULT_MATH_COMPLEXITY,
} from "@/features/generate/constants/difficulty-settings"
import { DEFAULT_SUBJECT, generateWorksheetInputSchema } from "@/features/generate/schemas"
import type { ConceptualDifficulty, MathComplexity } from "@/features/generate/types"

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
  findVariableIds: string[]
  targetRandomize: boolean
  mathComplexity: MathComplexity
  conceptualDifficulty: ConceptualDifficulty
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

  const hasVariableConstraints =
    params.givenVariableIds.length > 0 ||
    params.findVariableIds.length > 0 ||
    params.targetRandomize

  const variablePayload = hasVariableConstraints
    ? (() => {
        const { given, target } = toVariableRows(
          params.givenVariableIds,
          params.findVariableIds
        )
        const payload: {
          given_variables?: ReturnType<typeof mapGivenRowsToVariables>
          target_variables?: ReturnType<typeof mapTargetRowsToVariables>
          target_randomize?: boolean
        } = {}

        if (given.length > 0) {
          payload.given_variables = mapGivenRowsToVariables(given)
        }

        if (target.length > 0) {
          payload.target_variables = mapTargetRowsToVariables(target)
        }

        if (params.targetRandomize) {
          payload.target_randomize = true
        }

        return payload
      })()
    : {}

  return generateWorksheetInputSchema.safeParse({
    subject: DEFAULT_SUBJECT,
    lesson: resolvedLesson,
    scenario,
    question_count: params.effectiveQuestionCount,
    math_complexity: params.mathComplexity,
    conceptual_difficulty: params.conceptualDifficulty,
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
  const [findVariableIds, setFindVariableIds] = useState<string[]>([])
  const [targetRandomize, setTargetRandomize] = useState(false)
  const [mathComplexity, setMathComplexity] = useState<MathComplexity>(DEFAULT_MATH_COMPLEXITY)
  const [conceptualDifficulty, setConceptualDifficulty] = useState<ConceptualDifficulty>(
    DEFAULT_CONCEPTUAL_DIFFICULTY
  )

  const trimmedLesson = lesson.trim()
  const lessonScenarios =
    trimmedLesson ? getScenariosForLesson(trimmedLesson).scenarios : []
  const resolvedScenarioId = lessonScenarios.some((s) => s.id === scenarioId) ? scenarioId : ""
  const hasRequiredFields = Boolean(trimmedLesson && resolvedScenarioId)

  function applyVariablePruning(
    nextLesson: string,
    nextFindIds = findVariableIds,
    nextRandomize = targetRandomize
  ) {
    const pruned = pruneVariableSelection(
      nextLesson,
      givenVariableIds,
      nextFindIds,
      nextRandomize
    )
    setFindVariableIds(pruned.findVariableIds)
    setGivenVariableIds(pruned.givenVariableIds)
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

  function handleFindChange(ids: string[]) {
    const pruned = pruneVariableSelection(lesson, givenVariableIds, ids, targetRandomize)
    setFindVariableIds(pruned.findVariableIds)
    setGivenVariableIds(pruned.givenVariableIds)
  }

  function handleTargetRandomizeChange(enabled: boolean) {
    setTargetRandomize(enabled)
    const pruned = pruneVariableSelection(lesson, givenVariableIds, findVariableIds, enabled)
    setGivenVariableIds(pruned.givenVariableIds)
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
    findVariableIds,
    setFindVariableIds,
    targetRandomize,
    setTargetRandomize,
    mathComplexity,
    setMathComplexity,
    conceptualDifficulty,
    setConceptualDifficulty,
    trimmedLesson,
    hasRequiredFields,
    handleLessonChange,
    handleLessonSuggestionSelect,
    handleScenarioChange,
    handleFindChange,
    handleTargetRandomizeChange,
    buildInput: (effectiveQuestionCount: number) =>
      buildGenerateWorksheetInput({
        lesson,
        scenarioDescription,
        resolvedScenarioId,
        effectiveQuestionCount,
        givenVariableIds,
        findVariableIds,
        targetRandomize,
        mathComplexity,
        conceptualDifficulty,
      }),
  }
}

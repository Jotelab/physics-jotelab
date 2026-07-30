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
  DEFAULT_STAR_DIFFICULTY,
} from "@/features/generate/constants/difficulty-settings"
import { DEFAULT_SUBJECT, generateWorksheetInputSchema } from "@/features/generate/schemas"
import type { ConceptualDifficulty, MathComplexity } from "@/features/generate/types"

import {
  mapGivenRowsToVariables,
  mapTargetRowsToVariables,
} from "@/features/generate/utils/map-variable-rows"

/**
 * The stored scenario for a mixed-topic worksheet: with several topics in one
 * sheet no single scenario applies, so generation phrases each question
 * against a per-topic neutral scenario instead.
 */
const MIXED_TOPICS_SCENARIO =
  "Mixed topics — a typical everyday situation for each question's topic."

export function buildGenerateWorksheetInput(params: {
  lesson: string
  /** Topic-card selection (lesson preset ids). Overrides the free-text lesson. */
  selectedLessonIds?: string[]
  scenarioDescription: string
  resolvedScenarioId: string
  effectiveQuestionCount: number
  givenVariableIds: string[]
  findVariableIds: string[]
  targetRandomize: boolean
  mathComplexity: MathComplexity
  conceptualDifficulty: ConceptualDifficulty
  starDifficulty?: number
}) {
  const cardIds = params.selectedLessonIds ?? []
  const usingCards = cardIds.length > 0
  const isMultiTopic = cardIds.length > 1

  const lessonKey = resolveLessonKey(params.lesson)
  const resolvedLesson = usingCards
    ? getLessonLabel(cardIds[0])
    : lessonKey.isPreset && lessonKey.lessonId
      ? getLessonLabel(lessonKey.lessonId)
      : params.lesson.trim()

  const scenario = isMultiTopic
    ? MIXED_TOPICS_SCENARIO
    : params.scenarioDescription ||
      getScenarioDescription(cardIds[0] ?? params.lesson, params.resolvedScenarioId) ||
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
    ...(isMultiTopic ? { lessons: cardIds.map((id) => getLessonLabel(id)) } : {}),
    scenario,
    question_count: params.effectiveQuestionCount,
    math_complexity: params.mathComplexity,
    conceptual_difficulty: params.conceptualDifficulty,
    // Stars are the structural knob for engine-backed (card) topics; a custom
    // free-text lesson stays on the conceptual-difficulty prompt knob.
    ...(usingCards
      ? { star_difficulty: params.starDifficulty ?? DEFAULT_STAR_DIFFICULTY }
      : {}),
    ...variablePayload,
  })
}

export function useWorksheetConfigForm() {
  const [lesson, setLesson] = useState("")
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([])
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
  const [starDifficulty, setStarDifficulty] = useState<number>(DEFAULT_STAR_DIFFICULTY)

  const trimmedLesson = lesson.trim()
  // Cards win over free text; the first card is the primary lesson (drives
  // scenario + variable pickers, worksheet title, legacy `lesson` field).
  const primaryLesson = selectedLessonIds[0] ?? trimmedLesson
  const isMultiTopic = selectedLessonIds.length > 1
  const lessonScenarios =
    primaryLesson && !isMultiTopic ? getScenariosForLesson(primaryLesson).scenarios : []
  const resolvedScenarioId = lessonScenarios.some((s) => s.id === scenarioId) ? scenarioId : ""
  // Multi-topic sheets need no scenario pick (each question gets a per-topic
  // neutral scenario); single-topic flows keep requiring one.
  const hasRequiredFields = isMultiTopic || Boolean(primaryLesson && resolvedScenarioId)

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
    // Typing a custom topic replaces the card selection.
    if (newLesson.trim() && selectedLessonIds.length > 0) {
      setSelectedLessonIds([])
    }
    applyVariablePruning(newLesson)
  }

  function handleLessonSuggestionSelect() {
    setScenarioId("")
    setScenarioDescription("")
  }

  function handleLessonCardToggle(lessonId: string) {
    const next = selectedLessonIds.includes(lessonId)
      ? selectedLessonIds.filter((id) => id !== lessonId)
      : [...selectedLessonIds, lessonId]
    setSelectedLessonIds(next)
    // Cards replace the free-text lesson, and the scenario belongs to the
    // previous selection — reset both; variables re-prune against the new
    // primary topic.
    setLesson("")
    setScenarioId("")
    setScenarioDescription("")
    applyVariablePruning(next[0] ?? "")
  }

  function handleScenarioChange(id: string, description: string) {
    setScenarioId(id)
    setScenarioDescription(description)
  }

  function handleFindChange(ids: string[]) {
    const pruned = pruneVariableSelection(primaryLesson, givenVariableIds, ids, targetRandomize)
    setFindVariableIds(pruned.findVariableIds)
    setGivenVariableIds(pruned.givenVariableIds)
  }

  function handleTargetRandomizeChange(enabled: boolean) {
    setTargetRandomize(enabled)
    const pruned = pruneVariableSelection(
      primaryLesson,
      givenVariableIds,
      findVariableIds,
      enabled
    )
    setGivenVariableIds(pruned.givenVariableIds)
  }

  return {
    lesson,
    selectedLessonIds,
    primaryLesson,
    isMultiTopic,
    starDifficulty,
    setStarDifficulty,
    handleLessonCardToggle,
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
        selectedLessonIds,
        scenarioDescription,
        resolvedScenarioId,
        effectiveQuestionCount,
        givenVariableIds,
        findVariableIds,
        targetRandomize,
        mathComplexity,
        conceptualDifficulty,
        starDifficulty,
      }),
  }
}

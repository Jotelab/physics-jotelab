"use client"

import { useState } from "react"

import { findScenarioById, getScenariosForLesson, toVariableRows } from "@/features/generate/data/generation-presets"
import { generateWorksheetInputSchema } from "@/features/generate/schemas"
import type { Subject } from "@/features/generate/types"
import {
  mapGivenRowsToVariables,
  mapTargetRowsToVariables,
} from "@/features/generate/utils/map-variable-rows"

export function buildGenerateWorksheetInput(params: {
  subject: Subject | ""
  lesson: string
  scenarioDescription: string
  resolvedScenarioId: string
  effectiveQuestionCount: number
  givenVariableIds: string[]
  targetVariableId: string
}) {
  const scenario =
    params.scenarioDescription ||
    (params.subject
      ? findScenarioById(params.subject, params.lesson, params.resolvedScenarioId)?.description
      : undefined) ||
    ""

  const variablePayload =
    params.subject && (params.givenVariableIds.length > 0 || params.targetVariableId)
      ? (() => {
          const { given, target } = toVariableRows(
            params.subject,
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
    subject: params.subject,
    lesson: params.lesson,
    scenario,
    question_count: params.effectiveQuestionCount,
    ...variablePayload,
  })
}

export function useWorksheetConfigForm() {
  const [subject, setSubject] = useState<Subject | "">("")
  const [lesson, setLesson] = useState("")
  const [scenarioId, setScenarioId] = useState("")
  const [scenarioDescription, setScenarioDescription] = useState("")
  const [questionCount, setQuestionCount] = useState(10)

  const [activeTab, setActiveTab] = useState<"basic" | "advanced">("basic")
  const [givenVariableIds, setGivenVariableIds] = useState<string[]>([])
  const [targetVariableId, setTargetVariableId] = useState("")

  const trimmedLesson = lesson.trim()
  const lessonScenarios =
    subject && trimmedLesson ? getScenariosForLesson(subject, trimmedLesson).scenarios : []
  const resolvedScenarioId = lessonScenarios.some((s) => s.id === scenarioId) ? scenarioId : ""
  const hasRequiredFields = Boolean(subject && trimmedLesson && resolvedScenarioId)

  function handleSubjectChange(newSubject: Subject) {
    setSubject(newSubject)
    if (newSubject !== subject) {
      setLesson("")
      setScenarioId("")
      setScenarioDescription("")
      setGivenVariableIds([])
      setTargetVariableId("")
    }
  }

  function handleLessonChange(newLesson: string) {
    setLesson(newLesson)
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
    subject,
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
    handleSubjectChange,
    handleLessonChange,
    handleLessonSuggestionSelect,
    handleScenarioChange,
    buildInput: (effectiveQuestionCount: number) =>
      buildGenerateWorksheetInput({
        subject,
        lesson,
        scenarioDescription,
        resolvedScenarioId,
        effectiveQuestionCount,
        givenVariableIds,
        targetVariableId,
      }),
  }
}

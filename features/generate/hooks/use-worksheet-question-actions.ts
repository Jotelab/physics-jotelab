"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import { editQuestionAction, regenerateQuestionAction } from "@/features/generate/actions"
import type { WorksheetQuestion } from "@/features/generate/types"
import {
  getEditedQuestionFromDraft,
  getEditQuestionDraft,
  type EditQuestionDraft,
} from "@/features/worksheet/components/edit-question-dialog"

export function useWorksheetQuestionActions({
  worksheetId,
  replaceQuestion,
  onCreditBalanceUpdated,
  onRefresh,
  isGenerating,
}: {
  worksheetId: string | null
  replaceQuestion: (question: WorksheetQuestion) => void
  onCreditBalanceUpdated: (creditBalance: number) => void
  onRefresh: () => void
  isGenerating: boolean
}) {
  const t = useTranslations("generate")
  const tErrors = useTranslations("errors")
  const [openMenuQuestionId, setOpenMenuQuestionId] = useState<string | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<WorksheetQuestion | null>(null)
  const [editDraft, setEditDraft] = useState<EditQuestionDraft | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [busyQuestionId, setBusyQuestionId] = useState<string | null>(null)

  function clearActionFeedback() {
    setActionError(null)
    setActionMessage(null)
  }

  function handleEdit(question: WorksheetQuestion) {
    setOpenMenuQuestionId(null)
    clearActionFeedback()
    setEditError(null)
    setEditingQuestion(question)
    setEditDraft(getEditQuestionDraft(question))
  }

  async function handleSaveEdit() {
    if (!editingQuestion || !editDraft || !worksheetId) return

    setEditError(null)
    clearActionFeedback()
    setBusyQuestionId(editingQuestion.id)

    try {
      const editedQuestion = getEditedQuestionFromDraft(editingQuestion, editDraft)
      const result = await editQuestionAction({
        worksheetId,
        questionId: editingQuestion.id,
        editedQuestion,
      })

      if (!result.ok) {
        setEditError(result.message)
        return
      }

      replaceQuestion(result.data.question)
      setEditingQuestion(null)
      setEditDraft(null)
      setActionMessage(t("questionUpdated"))
    } catch {
      setEditError(t("checkEditedFields"))
    } finally {
      setBusyQuestionId(null)
    }
  }

  async function handleRegenerate(question: WorksheetQuestion) {
    if (!worksheetId) {
      setActionError(t("generateBeforeRegenerate"))
      return
    }

    setOpenMenuQuestionId(null)
    clearActionFeedback()
    setBusyQuestionId(question.id)

    const result = await regenerateQuestionAction({ worksheetId, questionId: question.id }).catch(
      () => ({
        ok: false as const,
        message: tErrors("REGENERATE_FAILED"),
      })
    )

    if (!result.ok) {
      setActionError(result.message)
      setBusyQuestionId(null)
      return
    }

    replaceQuestion(result.data.question)
    onCreditBalanceUpdated(result.data.creditBalance)
    setActionMessage(t("questionRegenerated"))
    onRefresh()
    setBusyQuestionId(null)
  }

  const editDialogProps =
    editingQuestion && editDraft
      ? {
          draft: editDraft,
          error: editError,
          isSaving: busyQuestionId === editingQuestion.id,
          onChange: setEditDraft,
          onCancel: () => {
            setEditingQuestion(null)
            setEditDraft(null)
            setEditError(null)
          },
          onSave: handleSaveEdit,
        }
      : null

  const questionActions = {
    actionsDisabled: isGenerating || Boolean(busyQuestionId),
    busyQuestionId,
    openMenuQuestionId,
    onToggleMenu: (questionId: string) =>
      setOpenMenuQuestionId((current) => (current === questionId ? null : questionId)),
    onEdit: handleEdit,
    onRegenerate: handleRegenerate,
  }

  return {
    actionError,
    actionMessage,
    setActionError,
    setActionMessage,
    clearActionFeedback,
    editDialogProps,
    questionActions,
  }
}

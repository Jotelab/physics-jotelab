"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { editQuestionAction, regenerateQuestionAction } from "@/features/generate/actions"
import { WorksheetPreviewPanel } from "@/features/generate/components/worksheet-preview-panel"
import type { WorksheetQuestion } from "@/features/generate/types"
import type { LibraryWorksheetDetail } from "@/features/library/types"
import {
  EditQuestionDialog,
  getEditedQuestionFromDraft,
  getEditQuestionDraft,
  type EditQuestionDraft,
} from "@/features/worksheet/components/edit-question-dialog"
import type { WorksheetViewMode } from "@/features/worksheet/components/worksheet-preview"
import { UnsavedVariantsDialog } from "@/features/worksheet/components/generate-variants-dialog"
import { useWorksheetHeaderConfig } from "@/features/worksheet/hooks/use-worksheet-header-config"

export function SavedWorksheetViewer({
  worksheet,
  creditBalance,
}: {
  worksheet: LibraryWorksheetDetail
  creditBalance: number
}) {
  return (
    <SavedWorksheetEditor
      key={`${worksheet.id}:${worksheet.updatedAt}`}
      worksheet={worksheet}
      creditBalance={creditBalance}
    />
  )
}

function SavedWorksheetEditor({
  worksheet,
  creditBalance,
}: {
  worksheet: LibraryWorksheetDetail
  creditBalance: number
}) {
  const router = useRouter()
  const t = useTranslations("library")
  const tGenerate = useTranslations("generate")
  const tErrors = useTranslations("errors")
  const [viewMode, setViewMode] = useState<WorksheetViewMode>("worksheet")
  const [questions, setQuestions] = useState(worksheet.questions)
  const [localCreditBalance, setLocalCreditBalance] = useState(creditBalance)
  const [openMenuQuestionId, setOpenMenuQuestionId] = useState<string | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<WorksheetQuestion | null>(null)
  const [editDraft, setEditDraft] = useState<EditQuestionDraft | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [busyQuestionId, setBusyQuestionId] = useState<string | null>(null)
  const [hasUnsavedVariants, setHasUnsavedVariants] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const scenario = worksheet.generationSettings?.scenario ?? t("savedWorksheet")
  const actualQuestionCount = questions.length
  const isIncomplete = actualQuestionCount < worksheet.expectedQuestionCount
  const defaultInstructions = tGenerate("questionsSubtitle", {
    count: worksheet.expectedQuestionCount,
    scenario,
  })
  const { resolvedHeader, onHeaderChange } = useWorksheetHeaderConfig({
    worksheetId: worksheet.id,
    defaultTitle: worksheet.title,
    defaultInstructions,
    savedHeader: worksheet.generationSettings?.header ?? null,
  })

  function replaceQuestion(updatedQuestion: WorksheetQuestion) {
    setQuestions((current) =>
      current
        .map((question) => (question.id === updatedQuestion.id ? updatedQuestion : question))
        .sort((a, b) => a.order - b.order)
    )
  }

  function handleEdit(question: WorksheetQuestion) {
    setOpenMenuQuestionId(null)
    setActionError(null)
    setActionMessage(null)
    setEditError(null)
    setEditingQuestion(question)
    setEditDraft(getEditQuestionDraft(question))
  }

  async function handleSaveEdit() {
    if (!editingQuestion || !editDraft) {
      return
    }

    setEditError(null)
    setActionError(null)
    setActionMessage(null)
    setBusyQuestionId(editingQuestion.id)

    try {
      const editedQuestion = getEditedQuestionFromDraft(editingQuestion, editDraft)
      const result = await editQuestionAction({
        worksheetId: worksheet.id,
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
      setActionMessage(tGenerate("questionUpdated"))
      router.refresh()
    } catch {
      setEditError(tGenerate("checkEditedFields"))
    } finally {
      setBusyQuestionId(null)
    }
  }

  async function handleRegenerate(question: WorksheetQuestion) {
    setOpenMenuQuestionId(null)
    setActionError(null)
    setActionMessage(null)
    setBusyQuestionId(question.id)

    const result = await regenerateQuestionAction({
      worksheetId: worksheet.id,
      questionId: question.id,
    }).catch(() => ({
      ok: false as const,
      message: tErrors("REGENERATE_FAILED"),
    }))

    if (!result.ok) {
      setActionError(result.message)
      setBusyQuestionId(null)
      return
    }

    replaceQuestion(result.data.question)
    setActionMessage(tGenerate("questionRegenerated"))
    setLocalCreditBalance(result.data.creditBalance)
    router.refresh()
    setBusyQuestionId(null)
  }

  return (
    <>
      <div className="border-b bg-background px-6 py-3 print:hidden">
        <Button
          type="button"
          variant="outline"
          size="touch"
          onClick={() => {
            if (hasUnsavedVariants) {
              setLeaveDialogOpen(true)
              return
            }
            router.push("/library")
          }}
        >
          {t("backToLibrary")}
        </Button>
      </div>

      <WorksheetPreviewPanel
        worksheetTitle={resolvedHeader.title}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        header={resolvedHeader}
        onHeaderChange={onHeaderChange}
        questions={questions}
        skippedSlots={[]}
        questionActions={{
          actionsDisabled: Boolean(busyQuestionId),
          busyQuestionId,
          openMenuQuestionId,
          onToggleMenu: (questionId) =>
            setOpenMenuQuestionId((current) => (current === questionId ? null : questionId)),
          onEdit: handleEdit,
          onRegenerate: handleRegenerate,
        }}
        worksheetId={worksheet.id}
        creditBalance={localCreditBalance}
        savedVariants={worksheet.savedVariants}
        isWorksheetComplete={!isIncomplete}
        onCreditBalanceUpdated={setLocalCreditBalance}
        onVariantsSaved={() => router.refresh()}
        onVariantActionMessage={setActionMessage}
        onVariantActionError={setActionError}
        onUnsavedVariantsChange={setHasUnsavedVariants}
        onRequestLeave={() => router.push("/library")}
      />

      {isIncomplete ? (
        <p className="border-b bg-background px-6 py-2 text-sm text-muted-foreground print:hidden">
          {t("incompleteGenerated", {
            actual: actualQuestionCount,
            expected: worksheet.expectedQuestionCount,
          })}
        </p>
      ) : null}

      {actionError ? (
        <p className="fixed right-4 bottom-4 z-40 max-w-sm rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive shadow-sm print:hidden">
          {actionError}
        </p>
      ) : null}
      {actionMessage ? (
        <p className="fixed right-4 bottom-4 z-40 max-w-sm rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm print:hidden">
          {actionMessage}
        </p>
      ) : null}

      {editingQuestion && editDraft ? (
        <EditQuestionDialog
          draft={editDraft}
          error={editError}
          isSaving={busyQuestionId === editingQuestion.id}
          onChange={setEditDraft}
          onCancel={() => {
            setEditingQuestion(null)
            setEditDraft(null)
            setEditError(null)
          }}
          onSave={handleSaveEdit}
        />
      ) : null}

      <UnsavedVariantsDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        onConfirmLeave={() => {
          setLeaveDialogOpen(false)
          router.push("/library")
        }}
      />
    </>
  )
}

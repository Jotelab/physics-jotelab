"use client"

import { FileText } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { editQuestionAction, regenerateQuestionAction } from "@/features/generate/actions"
import type { WorksheetQuestion } from "@/features/generate/types"
import type { LibraryWorksheetDetail } from "@/features/library/types"
import {
  EditQuestionDialog,
  getEditedQuestionFromDraft,
  getEditQuestionDraft,
  type EditQuestionDraft,
} from "@/features/worksheet/components/edit-question-dialog"
import { ExportPdfButton } from "@/features/worksheet/components/export-pdf-button"
import { WorksheetPreview, type WorksheetViewMode } from "@/features/worksheet/components/worksheet-preview"
import { useWorksheetHeaderConfig } from "@/features/worksheet/hooks/use-worksheet-header-config"
import { SegmentedControl } from "@/components/ui/segmented-control"

export function SavedWorksheetViewer({ worksheet }: { worksheet: LibraryWorksheetDetail }) {
  return (
    <SavedWorksheetEditor
      key={`${worksheet.id}:${worksheet.updatedAt}`}
      worksheet={worksheet}
    />
  )
}

function SavedWorksheetEditor({ worksheet }: { worksheet: LibraryWorksheetDetail }) {
  const router = useRouter()
  const t = useTranslations("library")
  const tGenerate = useTranslations("generate")
  const tErrors = useTranslations("errors")
  const [viewMode, setViewMode] = useState<WorksheetViewMode>("worksheet")
  const [questions, setQuestions] = useState(worksheet.questions)
  const [openMenuQuestionId, setOpenMenuQuestionId] = useState<string | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<WorksheetQuestion | null>(null)
  const [editDraft, setEditDraft] = useState<EditQuestionDraft | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [busyQuestionId, setBusyQuestionId] = useState<string | null>(null)
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
    router.refresh()
    setBusyQuestionId(null)
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/30">
      <div className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3 print:hidden md:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{resolvedHeader.title}</span>
          </div>
          {isIncomplete ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("incompleteGenerated", {
                actual: actualQuestionCount,
                expected: worksheet.expectedQuestionCount,
              })}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <ExportPdfButton />
          <SegmentedControl
            value={viewMode}
            onValueChange={setViewMode}
            options={[
              { value: "worksheet", label: tGenerate("worksheet") },
              { value: "answer", label: tGenerate("answer") },
            ]}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4 print:bg-white print:p-0 sm:p-6 lg:p-8">
        <WorksheetPreview
          header={resolvedHeader}
          onHeaderChange={onHeaderChange}
          questions={questions}
          viewMode={viewMode}
          emptyMessage={t("emptySavedWorksheet")}
          questionActions={{
            actionsDisabled: Boolean(busyQuestionId),
            busyQuestionId,
            openMenuQuestionId,
            onToggleMenu: (questionId) =>
              setOpenMenuQuestionId((current) =>
                current === questionId ? null : questionId
              ),
            onEdit: handleEdit,
            onRegenerate: handleRegenerate,
          }}
        />
      </div>

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
    </section>
  )
}

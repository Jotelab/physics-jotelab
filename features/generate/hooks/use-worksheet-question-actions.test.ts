import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

const editQuestionAction = vi.fn()
const regenerateQuestionAction = vi.fn()

vi.mock("@/features/generate/actions", () => ({
  editQuestionAction: (...args: unknown[]) => editQuestionAction(...args),
  regenerateQuestionAction: (...args: unknown[]) => regenerateQuestionAction(...args),
}))

import { useWorksheetQuestionActions } from "./use-worksheet-question-actions"

const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"

function renderQuestionActions(
  overrides: Partial<Parameters<typeof useWorksheetQuestionActions>[0]> = {}
) {
  const replaceQuestion = vi.fn()
  const onCreditBalanceUpdated = vi.fn()
  const onRefresh = vi.fn()

  const hook = renderHook(() =>
    useWorksheetQuestionActions({
      worksheetId,
      replaceQuestion,
      onCreditBalanceUpdated,
      onRefresh,
      isGenerating: false,
      ...overrides,
    })
  )

  return { ...hook, replaceQuestion, onCreditBalanceUpdated, onRefresh }
}

describe("useWorksheetQuestionActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("saves an edit successfully", async () => {
    const updatedQuestion = {
      ...validWorksheetQuestion,
      question_text: "Updated question text",
    }
    editQuestionAction.mockResolvedValue({
      ok: true,
      data: { question: updatedQuestion },
    })

    const { result, replaceQuestion } = renderQuestionActions()

    act(() => {
      result.current.questionActions.onEdit(validWorksheetQuestion)
    })

    expect(result.current.editDialogProps).not.toBeNull()

    await act(async () => {
      await result.current.editDialogProps!.onSave()
    })

    expect(editQuestionAction).toHaveBeenCalledWith({
      worksheetId,
      questionId: validWorksheetQuestion.id,
      editedQuestion: expect.objectContaining({
        question_text: validWorksheetQuestion.question_text,
      }),
    })
    expect(replaceQuestion).toHaveBeenCalledWith(updatedQuestion)
    expect(result.current.editDialogProps).toBeNull()
    expect(result.current.actionMessage).toBe("Question updated.")
    expect(result.current.actionError).toBeNull()
  })

  it("sets editError when editQuestionAction fails", async () => {
    editQuestionAction.mockResolvedValue({
      ok: false,
      message: "Could not save the edited question.",
    })

    const { result, replaceQuestion } = renderQuestionActions()

    act(() => {
      result.current.questionActions.onEdit(validWorksheetQuestion)
    })

    await act(async () => {
      await result.current.editDialogProps!.onSave()
    })

    expect(result.current.editDialogProps?.error).toBe("Could not save the edited question.")
    expect(replaceQuestion).not.toHaveBeenCalled()
    expect(result.current.actionMessage).toBeNull()
  })

  it("regenerates a question successfully", async () => {
    const regeneratedQuestion = {
      ...validWorksheetQuestion,
      question_text: "Regenerated question text",
    }
    regenerateQuestionAction.mockResolvedValue({
      ok: true,
      data: { question: regeneratedQuestion, creditBalance: 7 },
    })

    const { result, replaceQuestion, onCreditBalanceUpdated, onRefresh } = renderQuestionActions()

    await act(async () => {
      await result.current.questionActions.onRegenerate(validWorksheetQuestion)
    })

    expect(regenerateQuestionAction).toHaveBeenCalledWith({
      worksheetId,
      questionId: validWorksheetQuestion.id,
      attemptId: expect.any(String),
    })
    expect(replaceQuestion).toHaveBeenCalledWith(regeneratedQuestion)
    expect(onCreditBalanceUpdated).toHaveBeenCalledWith(7)
    expect(onRefresh).toHaveBeenCalled()
    expect(result.current.actionMessage).toBe("Question regenerated.")
    expect(result.current.questionActions.busyQuestionId).toBeNull()
  })

  it("sets actionError when regenerateQuestionAction fails", async () => {
    regenerateQuestionAction.mockResolvedValue({
      ok: false,
      message: "Could not regenerate the question.",
    })

    const { result, replaceQuestion, onCreditBalanceUpdated } = renderQuestionActions()

    await act(async () => {
      await result.current.questionActions.onRegenerate(validWorksheetQuestion)
    })

    expect(result.current.actionError).toBe("Could not regenerate the question.")
    expect(replaceQuestion).not.toHaveBeenCalled()
    expect(onCreditBalanceUpdated).not.toHaveBeenCalled()
    expect(result.current.questionActions.busyQuestionId).toBeNull()
  })

  it("tracks busyQuestionId while an async action is running", async () => {
    let resolveEdit!: (value: { ok: true; data: { question: typeof validWorksheetQuestion } }) => void
    editQuestionAction.mockReturnValue(
      new Promise((resolve) => {
        resolveEdit = resolve
      })
    )

    const { result } = renderQuestionActions()

    act(() => {
      result.current.questionActions.onEdit(validWorksheetQuestion)
    })

    let savePromise: Promise<void> | undefined

    act(() => {
      savePromise = result.current.editDialogProps!.onSave()
    })

    expect(result.current.questionActions.busyQuestionId).toBe(validWorksheetQuestion.id)
    expect(result.current.questionActions.actionsDisabled).toBe(true)
    expect(result.current.editDialogProps?.isSaving).toBe(true)

    await act(async () => {
      resolveEdit({ ok: true, data: { question: validWorksheetQuestion } })
      await savePromise
    })

    expect(result.current.questionActions.busyQuestionId).toBeNull()
    expect(result.current.questionActions.actionsDisabled).toBe(false)
  })

  it("disables question actions while generation is running", () => {
    const { result } = renderQuestionActions({ isGenerating: true })

    expect(result.current.questionActions.actionsDisabled).toBe(true)
  })

  it("does not call editQuestionAction when worksheetId is null", async () => {
    const { result } = renderQuestionActions({ worksheetId: null })

    act(() => {
      result.current.questionActions.onEdit(validWorksheetQuestion)
    })

    await act(async () => {
      await result.current.editDialogProps!.onSave()
    })

    expect(editQuestionAction).not.toHaveBeenCalled()
  })

  it("sets actionError instead of regenerating when worksheetId is null", async () => {
    const { result } = renderQuestionActions({ worksheetId: null })

    await act(async () => {
      await result.current.questionActions.onRegenerate(validWorksheetQuestion)
    })

    expect(regenerateQuestionAction).not.toHaveBeenCalled()
    expect(result.current.actionError).toBe(
      "Generate a worksheet before regenerating questions."
    )
  })
})

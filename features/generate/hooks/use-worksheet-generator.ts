"use client"

import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  getActiveGenerationJobForWorksheetAction,
  getGenerationJobAction,
  startAppendGenerationJobAction,
  startWorksheetGenerationJobAction,
} from "@/features/generate/generation-job-actions"
import { getWorksheetQuestionCountAction } from "@/features/generate/actions"
import type { GenerationJobPollResult } from "@/features/generate/generation-job-types"
import type {
  GenerateWorksheetInput,
  GenerationProgress,
  SkippedSlot,
  WorksheetQuestion,
} from "@/features/generate/types"
import { runGenerationJob } from "@/features/generate/utils/run-generation-job"

const JOB_POLL_INTERVAL_MS = 2000

type GeneratorState = {
  isGenerating: boolean
  progress: GenerationProgress | null
  worksheetId: string | null
  targetQuestionCount: number | null
  activeJobId: string | null
  questions: WorksheetQuestion[]
  skippedSlots: SkippedSlot[]
  error: string | null
  statusMessage: string | null
}

const initialState: GeneratorState = {
  isGenerating: false,
  progress: null,
  worksheetId: null,
  targetQuestionCount: null,
  activeJobId: null,
  questions: [],
  skippedSlots: [],
  error: null,
  statusMessage: null,
}

export type AppendQuestionsSnapshot = {
  questions: WorksheetQuestion[]
  skippedSlots: SkippedSlot[]
}

export type AppendQuestionsResult =
  | { ok: true; newQuestionCount: number; stoppedForCredits?: boolean }
  | { ok: false }

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useWorksheetGenerator({
  onCreditBalanceUpdated,
}: {
  onCreditBalanceUpdated?: (creditBalance: number) => void
} = {}) {
  const tErrors = useTranslations("errors")
  const [state, setState] = useState<GeneratorState>(initialState)
  const isMountedRef = useRef(true)
  const isGeneratingRef = useRef(false)
  // Monotonic token identifying the active poll loop. Each new poll (or abort)
  // bumps it, so a superseded loop sees its captured token go stale and exits
  // instead of two loops racing on a shared boolean and fighting over setState.
  const pollTokenRef = useRef(0)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      pollTokenRef.current += 1
    }
  }, [])

  useEffect(() => {
    isGeneratingRef.current = state.isGenerating
  }, [state.isGenerating])

  const syncTargetQuestionCount = useCallback(async (worksheetId: string): Promise<number | null> => {
    const result = await getWorksheetQuestionCountAction(worksheetId).catch(() => null)

    if (!result?.ok) {
      return null
    }

    const questionCount = result.data.questionCount

    if (isMountedRef.current) {
      setState((current) => ({
        ...current,
        targetQuestionCount: questionCount,
      }))
    }

    return questionCount
  }, [])

  const applyPollResult = useCallback(
    (poll: GenerationJobPollResult) => {
      if (poll.creditBalance != null) {
        onCreditBalanceUpdated?.(poll.creditBalance)
      }

      setState((current) => ({
        ...current,
        worksheetId: poll.worksheetId,
        activeJobId: poll.jobId,
        targetQuestionCount: poll.targetQuestionCount,
        questions: poll.questions,
        skippedSlots: poll.skippedSlots,
        progress: poll.progress,
        statusMessage: poll.statusMessage,
        isGenerating: !poll.isTerminal,
        error: poll.status === "failed" ? poll.statusMessage : current.error,
      }))
    },
    [onCreditBalanceUpdated]
  )

  const pollJobUntilTerminal = useCallback(
    async (jobId: string): Promise<GenerationJobPollResult | null> => {
      const token = (pollTokenRef.current += 1)

      while (isMountedRef.current && pollTokenRef.current === token) {
        const result = await getGenerationJobAction(jobId).catch(() => null)

        if (!result?.ok) {
          if (isMountedRef.current) {
            setState((current) => ({
              ...current,
              isGenerating: false,
              error: result?.message ?? tErrors("couldNotLoadProgress"),
            }))
          }
          return null
        }

        applyPollResult(result.data)

        if (result.data.isTerminal) {
          return result.data
        }

        await sleep(JOB_POLL_INTERVAL_MS)
      }

      return null
    },
    [applyPollResult, tErrors]
  )

  const runJob = useCallback(
    (params: Omit<Parameters<typeof runGenerationJob>[0], "abortPoll" | "pollUntilTerminal" | "syncTargetQuestionCount" | "isMounted">) =>
      runGenerationJob({
        ...params,
        abortPoll: () => {
          pollTokenRef.current += 1
        },
        pollUntilTerminal: pollJobUntilTerminal,
        syncTargetQuestionCount,
        isMounted: () => isMountedRef.current,
      }),
    [pollJobUntilTerminal, syncTargetQuestionCount]
  )

  const resumeActiveJob = useCallback(
    async (worksheetId: string) => {
      const active = await getActiveGenerationJobForWorksheetAction(worksheetId).catch(() => null)

      if (!active?.ok || !active.data?.jobId) {
        return
      }

      setState((current) => ({
        ...current,
        worksheetId,
        isGenerating: true,
        statusMessage: "Resuming generation...",
      }))

      await pollJobUntilTerminal(active.data.jobId)
      await syncTargetQuestionCount(worksheetId)
    },
    [pollJobUntilTerminal, syncTargetQuestionCount]
  )

  function replaceQuestion(updatedQuestion: WorksheetQuestion) {
    setState((current) => ({
      ...current,
      questions: current.questions
        .map((question) => (question.id === updatedQuestion.id ? updatedQuestion : question))
        .sort((a, b) => a.order - b.order),
    }))
  }

  function finishTerminalPoll(terminal: GenerationJobPollResult) {
    setState((current) => ({
      ...current,
      isGenerating: false,
      progress: terminal.progress,
      statusMessage: terminal.statusMessage,
    }))
  }

  async function startGeneration(input: GenerateWorksheetInput) {
    setState({
      ...initialState,
      isGenerating: true,
      progress: { current: 0, total: input.question_count },
      statusMessage: "Starting worksheet...",
    })

    const result = await runJob({
      startJob: () => startWorksheetGenerationJobAction(input),
      onJobStarted: ({ jobId, worksheetId }) => {
        setState((current) => ({
          ...current,
          worksheetId,
          activeJobId: jobId,
          targetQuestionCount: input.question_count,
          statusMessage: "Generating questions...",
        }))
      },
      startNetworkErrorMessage:
        "Generation stopped before it could start. Please try again.",
    })

    if (!result.ok) {
      if (result.reason === "start_network_error" || result.reason === "start_failed") {
        setState({
          ...initialState,
          error: result.message,
        })
      }
      return
    }

    if (result.terminal.stoppedForCredits) {
      return
    }

    finishTerminalPoll(result.terminal)
  }

  async function appendQuestions(
    worksheetId: string,
    additionalCount: number,
    snapshot: AppendQuestionsSnapshot
  ): Promise<AppendQuestionsResult> {
    if (!worksheetId || additionalCount < 1) {
      return { ok: false }
    }

    if (isGeneratingRef.current) {
      return { ok: false }
    }

    const startingQuestions = snapshot.questions
    const startingSkipped = snapshot.skippedSlots

    setState((current) => {
      const preExtendTargetCount =
        current.targetQuestionCount ??
        Math.max(
          0,
          ...startingQuestions.map((question) => question.order),
          ...startingSkipped.map((slot) => slot.order)
        )

      return {
        ...current,
        worksheetId,
        questions: startingQuestions,
        skippedSlots: startingSkipped,
        isGenerating: true,
        error: null,
        statusMessage: "Extending worksheet...",
        progress: {
          current: preExtendTargetCount,
          total: preExtendTargetCount + additionalCount,
        },
      }
    })

    const result = await runJob({
      startJob: () =>
        startAppendGenerationJobAction({
          worksheetId,
          additionalCount,
        }),
      onJobStarted: ({ jobId, newQuestionCount }) => {
        setState((current) => ({
          ...current,
          activeJobId: jobId,
          targetQuestionCount: newQuestionCount ?? current.targetQuestionCount,
          statusMessage: "Generating additional questions...",
        }))
      },
      startNetworkErrorMessage: "Could not append questions. Please try again.",
    })

    if (!result.ok) {
      if (result.reason === "start_network_error" || result.reason === "start_failed") {
        setState((current) => ({
          ...current,
          isGenerating: false,
          error: result.message,
        }))
      }
      return { ok: false }
    }

    const newQuestionCount =
      result.startData.newQuestionCount ?? result.terminal.targetQuestionCount

    if (result.terminal.stoppedForCredits) {
      return { ok: true, newQuestionCount, stoppedForCredits: true }
    }

    finishTerminalPoll(result.terminal)

    return { ok: true, newQuestionCount }
  }

  return {
    ...state,
    startGeneration,
    appendQuestions,
    replaceQuestion,
    syncTargetQuestionCount,
    resumeActiveJob,
  }
}

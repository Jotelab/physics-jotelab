import type { GenerationJobPollResult } from "@/features/generate/generation-job-types"
import type { ActionResult } from "@/features/generate/result-types"

export type RunGenerationJobStartData = {
  jobId: string
  worksheetId: string
  newQuestionCount?: number
}

export type RunGenerationJobResult<T extends RunGenerationJobStartData> =
  | { ok: true; terminal: GenerationJobPollResult; startData: T }
  | { ok: false; reason: "start_network_error"; message: string }
  | { ok: false; reason: "start_failed"; message: string }
  | { ok: false; reason: "poll_failed" }
  | { ok: false; reason: "unmounted" }

export async function runGenerationJob<T extends RunGenerationJobStartData>(params: {
  abortPoll: () => void
  startJob: () => Promise<ActionResult<T> | null>
  onJobStarted?: (startData: T) => void | Promise<void>
  pollUntilTerminal: (jobId: string) => Promise<GenerationJobPollResult | null>
  syncTargetQuestionCount: (worksheetId: string) => Promise<unknown>
  startNetworkErrorMessage: string
  isMounted?: () => boolean
}): Promise<RunGenerationJobResult<T>> {
  params.abortPoll()

  const started = await params.startJob().catch(() => null)

  if (!started) {
    return {
      ok: false,
      reason: "start_network_error",
      message: params.startNetworkErrorMessage,
    }
  }

  if (!started.ok) {
    return {
      ok: false,
      reason: "start_failed",
      message: started.message,
    }
  }

  await params.onJobStarted?.(started.data)

  const { jobId, worksheetId } = started.data
  const terminal = await params.pollUntilTerminal(jobId)
  await params.syncTargetQuestionCount(worksheetId)

  if (params.isMounted && !params.isMounted()) {
    return { ok: false, reason: "unmounted" }
  }

  if (!terminal) {
    return { ok: false, reason: "poll_failed" }
  }

  return {
    ok: true,
    terminal,
    startData: started.data,
  }
}

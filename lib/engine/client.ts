import "server-only"

import { sympyDataSchema, type SympyData } from "./sympy-data"

/**
 * Typed client for the symbolic engine service (jotelab-ai `service/app.py`).
 *
 * Every computed number the app shows comes through here: `POST /generate`
 * returns a `sympy_data` payload the engine has *already* run through its Data
 * Fidelity harness, so a response can only be one the engine vouches for. We
 * Zod-parse it at this boundary ({@link sympyDataSchema}) and trust `exact` /
 * `latex`, never the display `value` (ADR-005).
 *
 * Auth is the shared-secret `X-Engine-Api-Key` header; base URL and key come
 * from `ENGINE_BASE_URL` / `ENGINE_API_KEY` (both pinned in `.env.example`).
 */

const DEFAULT_TIMEOUT_MS = 15_000

/** Difficulty band the engine understands (its `easy | medium | hard`). */
export type EngineDifficulty = "easy" | "medium" | "hard"

export type EngineGenerateParams = {
  topic: string
  difficulty: EngineDifficulty
  /** Advanced mode: pin the three Given variable names, e.g. `["u", "a", "t"]`. */
  given?: string[]
  /** Advanced mode: pin the single Find/target variable, e.g. `"v"`. */
  find?: string
  /** RNG seed for reproducibility; the engine picks a fresh one when omitted. */
  seed?: number
  /**
   * Treat `given` as a subset constraint (Advanced-mode pins): the engine fills
   * in the rest of a valid split instead of requiring an exact one.
   */
  completeSplit?: boolean
  signal?: AbortSignal
}

/**
 * Thrown for any failure talking to the engine (network, auth, non-2xx, or a
 * malformed body). The caller fails the reservation and refunds the credit
 * rather than silently falling back to LLM-computed numbers — the
 * neuro-symbolic invariant is never quietly broken.
 */
export class EngineError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = "EngineError"
    this.status = status
  }
}

function requireConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.ENGINE_BASE_URL
  const apiKey = process.env.ENGINE_API_KEY

  if (!baseUrl || !apiKey) {
    throw new EngineError(
      "Symbolic engine is not configured (set ENGINE_BASE_URL and ENGINE_API_KEY)."
    )
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey }
}

/**
 * Generate one verified, fully-solved problem as `sympy_data`.
 *
 * Resolves only with a payload the engine has verified and that parses against
 * {@link sympyDataSchema}; every other outcome throws {@link EngineError}.
 */
export async function engineGenerate(
  params: EngineGenerateParams
): Promise<SympyData> {
  const { baseUrl, apiKey } = requireConfig()

  const body: Record<string, unknown> = {
    topic: params.topic,
    difficulty: params.difficulty,
  }
  if (params.given) body.given = params.given
  if (params.find) body.find = params.find
  if (params.seed != null) body.seed = params.seed
  if (params.completeSplit) body.complete_split = true

  const controller = params.signal ? undefined : new AbortController()
  const timeout = controller
    ? setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
    : undefined

  let response: Response
  try {
    response = await fetch(`${baseUrl}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Engine-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
      signal: params.signal ?? controller?.signal,
      cache: "no-store",
    })
  } catch (error) {
    throw new EngineError(
      `Could not reach the symbolic engine: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  } finally {
    if (timeout) clearTimeout(timeout)
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    throw new EngineError(
      `Engine /generate failed (${response.status})${detail ? `: ${detail}` : ""}`,
      response.status
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new EngineError("Engine /generate returned a non-JSON body.")
  }

  const parsed = sympyDataSchema.safeParse(payload)
  if (!parsed.success) {
    throw new EngineError(
      `Engine /generate payload did not match the sympy_data contract: ${parsed.error.message}`
    )
  }

  return parsed.data
}

async function readErrorDetail(response: Response): Promise<string | null> {
  try {
    const data = (await response.json()) as { detail?: unknown }
    if (typeof data?.detail === "string") return data.detail
    return null
  } catch {
    return null
  }
}

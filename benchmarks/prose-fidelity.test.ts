import { appendFileSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { APICallError, TypeValidationError } from "ai"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { checkDataFidelity } from "@/lib/ai/data-fidelity"
import { phraseQuestion } from "@/lib/ai/generate-engine-question"
import { engineGenerate, EngineError } from "@/lib/engine/client"
import { engineBackedLessons, type EngineTopic } from "@/lib/engine/topics"
import type { EngineDifficulty } from "@/lib/engine/client"

/**
 * End-to-end prose Data Fidelity + Schema Adherence (DEVELOPMENT_PLAN C4).
 *
 * Runs the *true* production pipeline — engine `POST /generate` → the real
 * phrasing prompt/schema (`phraseQuestion`) → `checkDataFidelity` — over every
 * engine-backed lesson of this branch × {easy, medium, hard} × seeds. One run
 * yields both report metrics:
 *
 * - **Schema Adherence**: share of `generateObject` calls whose first pass
 *   already satisfies the Zod schema (TypeValidationError = miss).
 * - **Prose Data Fidelity**: share of parsed phrasings whose Thai prose states
 *   exactly the engine's numbers — first-pass, and after the one corrective
 *   retry production performs.
 *
 * Results: benchmarks/results/prose-data-fidelity.md, schema-adherence.md, and
 * the raw per-instance prose-data-fidelity.jsonl (input for the LLM judge).
 *
 * Opt-in — needs a live engine and a real model key:
 *
 *   # engine (local docker or a deployed URL):
 *   docker run -d -e ENGINE_API_KEY=devkey -e PORT=10000 -p 18080:10000 jotelab-engine
 *   export ENGINE_BASE_URL=http://127.0.0.1:18080 ENGINE_API_KEY=devkey
 *   export GOOGLE_GENERATIVE_AI_API_KEY=...
 *   PROSE_BENCHMARK=1 npx vitest run benchmarks/prose-fidelity.test.ts
 *
 * Sizing knobs: PROSE_BENCHMARK_SEEDS (default 12 → 12 × 3 difficulties per
 * lesson; with only motion-1d wired that is 36 — set 34+ for a ≥100 sample),
 * PROSE_BENCHMARK_CONCURRENCY (default 3).
 */

const RUN = process.env.PROSE_BENCHMARK === "1"
const SEEDS = Number(process.env.PROSE_BENCHMARK_SEEDS ?? 12)
const CONCURRENCY = Number(process.env.PROSE_BENCHMARK_CONCURRENCY ?? 3)
const DIFFICULTIES: EngineDifficulty[] = ["easy", "medium", "hard"]
const RESULTS_DIR = join(process.cwd(), "benchmarks", "results")

type InstanceResult = {
  lessonId: string
  topic: string
  difficulty: EngineDifficulty
  seed: number
  status: "ok" | "engine_error" | "api_error"
  error?: string
  schemaFirstPassOk?: boolean
  questionText?: string
  firstPassFidelityOk?: boolean
  firstPassIssues?: string[]
  retried?: boolean
  finalFidelityOk?: boolean
  finalIssues?: string[]
  sympyData?: unknown
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * One phrasing attempt through the production prompt. Distinguishes a schema
 * miss (the metric) from API failures (excluded infra noise, retried with
 * backoff so a 429 does not poison the sample).
 */
async function attemptPhrasing(
  input: Parameters<typeof phraseQuestion>[0],
  sympyData: Parameters<typeof phraseQuestion>[1],
  topic: Parameters<typeof phraseQuestion>[2],
  correction?: string
): Promise<{ kind: "parsed"; text: string } | { kind: "schema_miss" } | { kind: "api_error"; error: string }> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const text = await phraseQuestion(input, sympyData, topic, correction)
      return { kind: "parsed", text }
    } catch (error) {
      if (error instanceof TypeValidationError || error instanceof z.ZodError) {
        return { kind: "schema_miss" }
      }
      if (error instanceof APICallError && error.statusCode === 429) {
        await sleep(20_000 * (attempt + 1))
        continue
      }
      return { kind: "api_error", error: error instanceof Error ? error.message : String(error) }
    }
  }
  return { kind: "api_error", error: "rate-limited after 5 backoff attempts" }
}

async function runInstance(
  lessonId: string,
  topic: EngineTopic,
  difficulty: EngineDifficulty,
  seed: number
): Promise<InstanceResult> {
  const base: InstanceResult = { lessonId, topic: topic.topic, difficulty, seed, status: "ok" }

  let sympyData
  try {
    sympyData = await engineGenerate({ topic: topic.topic, difficulty, seed })
  } catch (error) {
    return {
      ...base,
      status: "engine_error",
      error: error instanceof EngineError ? error.message : String(error),
    }
  }

  const input = {
    subject: "physics" as const,
    lesson: lessonId,
    scenario: "A typical everyday situation for this topic.",
    previousQuestionsContext: [],
  }

  const first = await attemptPhrasing(input, sympyData, topic)
  if (first.kind === "api_error") {
    return { ...base, status: "api_error", error: first.error }
  }
  if (first.kind === "schema_miss") {
    // Schema misses still count toward fidelity's denominator only once a
    // parse succeeds; production would retry the whole call. We record the
    // miss and stop — this instance measured Schema Adherence.
    return { ...base, schemaFirstPassOk: false, sympyData }
  }

  const firstFidelity = checkDataFidelity(first.text, sympyData)
  const result: InstanceResult = {
    ...base,
    schemaFirstPassOk: true,
    questionText: first.text,
    firstPassFidelityOk: firstFidelity.ok,
    firstPassIssues: firstFidelity.ok ? [] : firstFidelity.issues,
    retried: false,
    finalFidelityOk: firstFidelity.ok,
    finalIssues: [],
    sympyData,
  }

  if (firstFidelity.ok) return result

  // Production's one corrective retry (generate-engine-question.ts).
  const second = await attemptPhrasing(input, sympyData, topic, firstFidelity.issues.join(" "))
  result.retried = true
  if (second.kind !== "parsed") {
    result.finalFidelityOk = false
    result.finalIssues = [`retry did not parse (${second.kind})`]
    return result
  }
  const secondFidelity = checkDataFidelity(second.text, sympyData)
  result.questionText = second.text
  result.finalFidelityOk = secondFidelity.ok
  result.finalIssues = secondFidelity.ok ? [] : secondFidelity.issues
  return result
}

function pct(numerator: number, denominator: number): string {
  return denominator === 0 ? "n/a" : `${((100 * numerator) / denominator).toFixed(2)}%`
}

;(RUN ? describe : describe.skip)("prose data fidelity benchmark", () => {
  it(
    "measures schema adherence and prose fidelity over the true path",
    async () => {
      const lessons = engineBackedLessons()
      const work: { lessonId: string; topic: EngineTopic; difficulty: EngineDifficulty; seed: number }[] = []
      for (const { lessonId, topic } of lessons) {
        for (const difficulty of DIFFICULTIES) {
          for (let seed = 1; seed <= SEEDS; seed += 1) {
            work.push({ lessonId, topic, difficulty, seed })
          }
        }
      }

      const results: InstanceResult[] = []
      let cursor = 0
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          while (cursor < work.length) {
            const job = work[cursor]
            cursor += 1
            const result = await runInstance(job.lessonId, job.topic, job.difficulty, job.seed)
            results.push(result)
            console.log(
              `[prose-benchmark] ${results.length}/${work.length} ${job.topic.topic}/${job.difficulty}/seed${job.seed}: ` +
                (result.status !== "ok"
                  ? result.status
                  : result.schemaFirstPassOk === false
                    ? "schema_miss"
                    : result.finalFidelityOk
                      ? "ok"
                      : "fidelity_fail")
            )
          }
        })
      )

      const phrased = results.filter((r) => r.status === "ok")
      const parsedFirst = phrased.filter((r) => r.schemaFirstPassOk)
      const firstPassOk = parsedFirst.filter((r) => r.firstPassFidelityOk)
      const finalOk = parsedFirst.filter((r) => r.finalFidelityOk)
      const engineErrors = results.filter((r) => r.status === "engine_error")
      const apiErrors = results.filter((r) => r.status === "api_error")

      mkdirSync(RESULTS_DIR, { recursive: true })

      const jsonlPath = join(RESULTS_DIR, "prose-data-fidelity.jsonl")
      writeFileSync(jsonlPath, "")
      for (const r of results) appendFileSync(jsonlPath, `${JSON.stringify(r)}\n`)

      const byCell = new Map<string, InstanceResult[]>()
      for (const r of parsedFirst) {
        const key = `${r.topic} / ${r.difficulty}`
        byCell.set(key, [...(byCell.get(key) ?? []), r])
      }
      const cellRows = [...byCell.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cell, rows]) => {
          const first = rows.filter((r) => r.firstPassFidelityOk).length
          const final = rows.filter((r) => r.finalFidelityOk).length
          return `| ${cell} | ${rows.length} | ${pct(first, rows.length)} | ${pct(final, rows.length)} |`
        })
        .join("\n")

      const failureModes = parsedFirst
        .filter((r) => !r.firstPassFidelityOk)
        .flatMap((r) => r.firstPassIssues ?? [])
        .reduce((acc, issue) => acc.set(issue, (acc.get(issue) ?? 0) + 1), new Map<string, number>())
      const failureRows =
        [...failureModes.entries()]
          .sort(([, a], [, b]) => b - a)
          .map(([issue, count]) => `| ${count} | ${issue.replaceAll("|", "\\|")} |`)
          .join("\n") || "| — | no first-pass failures |"

      writeFileSync(
        join(RESULTS_DIR, "prose-data-fidelity.md"),
        `# End-to-end prose Data Fidelity

True path: engine \`POST /generate\` → production phrasing prompt
(\`phraseQuestion\`) → \`checkDataFidelity\`. Sample: every engine-backed lesson
of this branch × {easy, medium, hard} × ${SEEDS} seeds.

| Metric | Value |
|---|---|
| Instances attempted | ${results.length} |
| Engine errors (excluded) | ${engineErrors.length} |
| Model API errors (excluded) | ${apiErrors.length} |
| Parsed phrasings (denominator) | ${parsedFirst.length} |
| **First-pass prose fidelity** | **${pct(firstPassOk.length, parsedFirst.length)}** (${firstPassOk.length}/${parsedFirst.length}) |
| **After production's corrective retry** | **${pct(finalOk.length, parsedFirst.length)}** (${finalOk.length}/${parsedFirst.length}) |

## Per cell (first-pass / after-retry)

| Cell | n | First-pass | After retry |
|---|---|---|---|
${cellRows}

## First-pass failure modes

| Count | Issue |
|---|---|
${failureRows}

## How to test

\`\`\`bash
docker run -d -e ENGINE_API_KEY=devkey -e PORT=10000 -p 18080:10000 jotelab-engine
export ENGINE_BASE_URL=http://127.0.0.1:18080 ENGINE_API_KEY=devkey
export GOOGLE_GENERATIVE_AI_API_KEY=...
PROSE_BENCHMARK=1 PROSE_BENCHMARK_SEEDS=${SEEDS} npx vitest run benchmarks/prose-fidelity.test.ts
\`\`\`

Raw per-instance data: \`prose-data-fidelity.jsonl\` (also feeds the LLM judge).
`
      )

      writeFileSync(
        join(RESULTS_DIR, "schema-adherence.md"),
        `# Schema Adherence (first-pass Zod validity)

Share of production \`generateObject\` phrasing calls whose first pass already
matched the Zod schema. Same run as prose-data-fidelity.md.

| Metric | Value |
|---|---|
| Phrasing calls (first attempts) | ${phrased.length} |
| First-pass schema-valid | ${parsedFirst.length} |
| **Schema Adherence** | **${pct(parsedFirst.length, phrased.length)}** |

## How to test

\`\`\`bash
# Same command as prose-data-fidelity.md — one run produces both artefacts.
PROSE_BENCHMARK=1 npx vitest run benchmarks/prose-fidelity.test.ts
\`\`\`
`
      )

      // The benchmark's contract is honest reporting, not a threshold: it must
      // simply have produced a meaningful parsed sample.
      expect(parsedFirst.length).toBeGreaterThan(0)
    },
    7_200_000
  )
})

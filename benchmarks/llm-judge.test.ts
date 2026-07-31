import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { describe, expect, it } from "vitest"
import { z } from "zod"

/**
 * LLM-as-a-Judge for generated Thai physics questions (DEVELOPMENT_PLAN C4).
 *
 * Scores each phrased question from the prose-fidelity run
 * (benchmarks/results/prose-data-fidelity.jsonl) on two 1–5 rubrics:
 *
 * - **Thai fluency**: natural, grammatical Thai a Mathayom student reads
 *   without stumbling (5) → broken/machine-translated Thai (1).
 * - **Physical plausibility**: the scenario and magnitudes make real-world
 *   sense (5) → physically absurd setup (1).
 *
 * The judge is a *different* model (JUDGE_MODEL_ID, default gemini-2.5-pro)
 * from the gemini-2.5-flash generator, to limit self-preference bias.
 *
 * Human-agreement drop-in: the run writes human-ratings-template.csv with the
 * judged items in random-stable order. A reviewer fills the two score columns
 * (same rubrics) and saves it as benchmarks/results/human-ratings.csv; the
 * next run then reports exact / within-1 agreement and Pearson r per rubric —
 * the report's "equivalent to expert review" claim needs exactly this baseline.
 *
 * Opt-in — needs a real model key and a prior prose-fidelity run:
 *
 *   export GOOGLE_GENERATIVE_AI_API_KEY=...
 *   JUDGE_BENCHMARK=1 npx vitest run benchmarks/llm-judge.test.ts
 */

const RUN = process.env.JUDGE_BENCHMARK === "1"
const JUDGE_MODEL_ID = process.env.JUDGE_MODEL_ID ?? "gemini-2.5-pro"
const CONCURRENCY = Number(process.env.JUDGE_BENCHMARK_CONCURRENCY ?? 3)
const RESULTS_DIR = join(process.cwd(), "benchmarks", "results")

const judgeSchema = z.object({
  thai_fluency: z.number().int().min(1).max(5),
  physical_plausibility: z.number().int().min(1).max(5),
  rationale: z.string().min(1).max(500),
})

type JudgedItem = {
  id: string
  lessonId: string
  topic: string
  difficulty: string
  seed: number
  questionText: string
  thaiFluency?: number
  physicalPlausibility?: number
  rationale?: string
  error?: string
}

function judgePrompt(questionText: string): string {
  return `You are an expert Thai physics teacher reviewing an auto-generated worksheet question.

Score the question below on two independent 1-5 rubrics.

thai_fluency:
5 = natural, grammatical Thai; reads like a teacher wrote it
4 = fluent with one minor awkward phrase
3 = understandable but noticeably awkward or stilted
2 = hard to read; grammar mistakes impede understanding
1 = broken or machine-translated Thai

physical_plausibility:
5 = scenario and magnitudes fully realistic for the described situation
4 = realistic with one mildly unusual magnitude
3 = plausible setup but a magnitude is clearly odd (e.g. a runner at 40 m/s)
2 = setup strains physical sense
1 = physically absurd

Judge ONLY fluency and plausibility. Do not solve the problem; do not judge
difficulty or pedagogy. Question:

---
${questionText}
---`
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function judgeOne(item: JudgedItem): Promise<JudgedItem> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const { object } = await generateObject({
        model: google(JUDGE_MODEL_ID),
        schema: judgeSchema,
        prompt: judgePrompt(item.questionText),
      })
      return {
        ...item,
        thaiFluency: object.thai_fluency,
        physicalPlausibility: object.physical_plausibility,
        rationale: object.rationale,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes("429") || message.toLowerCase().includes("rate")) {
        await sleep(20_000 * (attempt + 1))
        continue
      }
      return { ...item, error: message }
    }
  }
  return { ...item, error: "rate-limited after 5 backoff attempts" }
}

type HumanRow = { id: string; thaiFluency: number; physicalPlausibility: number }

/** Parse benchmarks/results/human-ratings.csv (id,thai_fluency,physical_plausibility,...). */
function readHumanRatings(): HumanRow[] | null {
  const path = join(RESULTS_DIR, "human-ratings.csv")
  if (!existsSync(path)) return null
  const [header, ...lines] = readFileSync(path, "utf8").trim().split("\n")
  const cols = header.split(",").map((c) => c.trim())
  const idIdx = cols.indexOf("id")
  const fluencyIdx = cols.indexOf("thai_fluency")
  const plausIdx = cols.indexOf("physical_plausibility")
  if (idIdx < 0 || fluencyIdx < 0 || plausIdx < 0) return null
  return lines
    .map((line) => line.split(","))
    .map((parts) => ({
      id: parts[idIdx]?.trim() ?? "",
      thaiFluency: Number(parts[fluencyIdx]),
      physicalPlausibility: Number(parts[plausIdx]),
    }))
    .filter((row) => row.id && Number.isFinite(row.thaiFluency) && Number.isFinite(row.physicalPlausibility))
}

function pearson(a: number[], b: number[]): number {
  const n = a.length
  const meanA = a.reduce((s, x) => s + x, 0) / n
  const meanB = b.reduce((s, x) => s + x, 0) / n
  let cov = 0
  let varA = 0
  let varB = 0
  for (let i = 0; i < n; i += 1) {
    cov += (a[i] - meanA) * (b[i] - meanB)
    varA += (a[i] - meanA) ** 2
    varB += (b[i] - meanB) ** 2
  }
  return varA === 0 || varB === 0 ? NaN : cov / Math.sqrt(varA * varB)
}

function agreementBlock(
  label: string,
  pairs: { llm: number; human: number }[]
): string {
  const n = pairs.length
  const exact = pairs.filter((p) => p.llm === p.human).length
  const within1 = pairs.filter((p) => Math.abs(p.llm - p.human) <= 1).length
  const r = pearson(
    pairs.map((p) => p.llm),
    pairs.map((p) => p.human)
  )
  return `| ${label} | ${n} | ${((100 * exact) / n).toFixed(1)}% | ${((100 * within1) / n).toFixed(1)}% | ${Number.isNaN(r) ? "n/a" : r.toFixed(3)} |`
}

function mean(values: number[]): string {
  return values.length ? (values.reduce((s, x) => s + x, 0) / values.length).toFixed(2) : "n/a"
}

function distribution(values: number[]): string {
  return [1, 2, 3, 4, 5].map((score) => `${score}: ${values.filter((v) => v === score).length}`).join(", ")
}

;(RUN ? describe : describe.skip)("llm-as-a-judge benchmark", () => {
  it(
    "judges phrased questions on Thai fluency and physical plausibility",
    async () => {
      const sourcePath = join(RESULTS_DIR, "prose-data-fidelity.jsonl")
      if (!existsSync(sourcePath)) {
        throw new Error(
          "Run the prose-fidelity benchmark first — llm-judge scores its output (prose-data-fidelity.jsonl)."
        )
      }

      const items: JudgedItem[] = readFileSync(sourcePath, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((row) => row.status === "ok" && typeof row.questionText === "string")
        .map((row) => ({
          id: `${row.topic}-${row.difficulty}-s${row.seed}`,
          lessonId: row.lessonId,
          topic: row.topic,
          difficulty: row.difficulty,
          seed: row.seed,
          questionText: row.questionText,
        }))

      const judged: JudgedItem[] = []
      let cursor = 0
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          while (cursor < items.length) {
            const item = items[cursor]
            cursor += 1
            judged.push(await judgeOne(item))
            console.log(`[llm-judge] ${judged.length}/${items.length}`)
          }
        })
      )

      mkdirSync(RESULTS_DIR, { recursive: true })
      const jsonlPath = join(RESULTS_DIR, "llm-judge.jsonl")
      writeFileSync(jsonlPath, "")
      for (const row of judged) appendFileSync(jsonlPath, `${JSON.stringify(row)}\n`)

      const scored = judged.filter((row) => row.thaiFluency != null)
      const fluency = scored.map((row) => row.thaiFluency!)
      const plausibility = scored.map((row) => row.physicalPlausibility!)

      // Stable template so a human can rate the same items with the same rubric.
      writeFileSync(
        join(RESULTS_DIR, "human-ratings-template.csv"),
        `id,question_text,thai_fluency,physical_plausibility\n${scored
          .map((row) => `${row.id},"${row.questionText.replaceAll('"', '""')}",,`)
          .join("\n")}\n`
      )

      const human = readHumanRatings()
      let agreementSection = `## Human agreement

No \`human-ratings.csv\` found. To add the expert baseline: copy
\`human-ratings-template.csv\` to \`human-ratings.csv\`, fill the two score
columns using the rubric in benchmarks/llm-judge.test.ts, and re-run — this
section then reports exact / within-1 agreement and Pearson r.`
      if (human) {
        const byId = new Map(scored.map((row) => [row.id, row]))
        const fluencyPairs = human
          .filter((row) => byId.has(row.id))
          .map((row) => ({ llm: byId.get(row.id)!.thaiFluency!, human: row.thaiFluency }))
        const plausPairs = human
          .filter((row) => byId.has(row.id))
          .map((row) => ({ llm: byId.get(row.id)!.physicalPlausibility!, human: row.physicalPlausibility }))
        agreementSection = `## Human agreement

| Rubric | n | Exact | Within ±1 | Pearson r |
|---|---|---|---|---|
${agreementBlock("Thai fluency", fluencyPairs)}
${agreementBlock("Physical plausibility", plausPairs)}`
      }

      writeFileSync(
        join(RESULTS_DIR, "llm-judge.md"),
        `# LLM-as-a-Judge — Thai fluency & physical plausibility

Judge model: \`${JUDGE_MODEL_ID}\` (generator: gemini-2.5-flash). Items: every
successfully phrased question from prose-data-fidelity.jsonl.

| Metric | Value |
|---|---|
| Items judged | ${scored.length} (${judged.length - scored.length} judge errors) |
| Thai fluency mean | ${mean(fluency)} / 5 (dist ${distribution(fluency)}) |
| Physical plausibility mean | ${mean(plausibility)} / 5 (dist ${distribution(plausibility)}) |

${agreementSection}

## How to test

\`\`\`bash
export GOOGLE_GENERATIVE_AI_API_KEY=...
PROSE_BENCHMARK=1 npx vitest run benchmarks/prose-fidelity.test.ts   # produces the items
JUDGE_BENCHMARK=1 npx vitest run benchmarks/llm-judge.test.ts
\`\`\`
`
      )

      expect(scored.length).toBeGreaterThan(0)
    },
    7_200_000
  )
})

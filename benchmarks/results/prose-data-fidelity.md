# End-to-end prose Data Fidelity

True path: engine `POST /generate` → production phrasing prompt
(`phraseQuestion`) → `checkDataFidelity`. Sample: every engine-backed lesson
of this branch × {easy, medium, hard} × 1 seeds.

| Metric | Value |
|---|---|
| Instances attempted | 3 |
| Engine errors (excluded) | 0 |
| Model API errors (excluded) | 3 |
| Parsed phrasings (denominator) | 0 |
| **First-pass prose fidelity** | **n/a** (0/0) |
| **After production's corrective retry** | **n/a** (0/0) |

## Per cell (first-pass / after-retry)

| Cell | n | First-pass | After retry |
|---|---|---|---|


## First-pass failure modes

| Count | Issue |
|---|---|
| — | no first-pass failures |

## How to test

```bash
docker run -d -e ENGINE_API_KEY=devkey -e PORT=10000 -p 18080:10000 jotelab-engine
export ENGINE_BASE_URL=http://127.0.0.1:18080 ENGINE_API_KEY=devkey
export GOOGLE_GENERATIVE_AI_API_KEY=...
PROSE_BENCHMARK=1 PROSE_BENCHMARK_SEEDS=1 npx vitest run benchmarks/prose-fidelity.test.ts
```

Raw per-instance data: `prose-data-fidelity.jsonl` (also feeds the LLM judge).

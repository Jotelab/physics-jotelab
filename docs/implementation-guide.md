# Implementation guide

## Architecture (two repos)

```
jotelab-ai (Python)                    physics-jotelab (Next.js 16)
  engine/    SymPy generation            app/          routes (App Router)
  templates/ topic templates + scenes    features/     vertical slices
  harness/   Data Fidelity oracle        lib/engine/   service client + Zod contract
  service/   FastAPI (/generate,         lib/ai/       LLM calls + fidelity gate
             /verify, /chain)            lib/tikz/     TikZ → SVG pipeline
  benchmarks/ C4 runner                  lib/supabase/ auth/session/DB
                                         supabase/     SQL migrations (truth)
```

The seam is the `sympy_data` contract: produced by
`jotelab-ai/engine/contract.py`, transported by `service/app.py`, parsed by
`lib/engine/sympy-data.ts`, stored verbatim in `worksheet_questions`.

## Feature slices (`features/*`)

`auth`, `generate` (worksheet generation + credits + jobs), `worksheet`
(preview/export), `library`, `coach` (`/learn`), `i18n`. A slice owns its
actions, components, hooks, and tests; cross-slice imports go through `lib/`.

## Rules that keep the invariants

1. Numbers come from `sympy_data` — if you find yourself formatting a number
   the model produced, stop; that path must go through the engine.
2. Zod-parse at every trust boundary (engine responses, model output, DB
   payloads). A schema that strips a key the engine emits is a bug — declare
   it (see `auxiliary`/`diagram` in `lib/engine/sympy-data.ts`).
3. Reserve credits before model calls; every failure path refunds.
4. Coaching judgments are rule-based against the oracle — never an LLM.
5. `exact` over `value`: display floats are presentation only (ADR-005).

## Implementation order for a new engine topic

1. Template + tests in jotelab-ai (harness must pass 100%).
2. Map a lesson id in `lib/engine/topics.ts` with Thai variable metadata.
3. Nothing else — routing, assembly, and fidelity pick it up automatically.

## Dev environment

```bash
# engine service (from jotelab-ai):
ENGINE_API_KEY=dev-secret uvicorn service.app:app --port 8000
# web app (this repo):
npm install && npm run dev        # needs .env.local; see .env.example
```

Node 20–24 (Next 16 target). `E2E_STUB_GENERATION=1` runs the app without
model keys.

## How to test

```bash
npm run test          # vitest unit suites (all slices + lib)
npm run lint          # eslint
npm run test:e2e      # Playwright (public + authenticated projects)
# engine repo: pytest -q      (engine + harness + service + benchmarks)
```

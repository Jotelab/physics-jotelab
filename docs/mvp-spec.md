# MVP specification and acceptance criteria

What "shipped" means for the NSC 2026 submission. Each criterion names its
check — a criterion without a runnable check does not count as done.

## 1. Neuro-symbolic worksheet generation (SUVAT)

- Engine-backed lessons (`motion-1d` → `suvat`, `lib/engine/topics.ts`) get
  givens, steps, and answers assembled from `sympy_data`
  (`lib/engine/assemble-question.ts`); the LLM supplies prose only.
- Runtime Data Fidelity gate: numbers/units in the Thai text are compared to
  `sympy_data`; a mismatch retries and, on repeated failure, refunds the
  reserved credit (`lib/ai/data-fidelity.ts`, `features/generate/`).
- Seed-based regenerate/re-roll — no free-form LLM call
  (`features/generate/generate-question-core.ts`).

**Check:** `npx vitest run features/generate lib/ai lib/engine`

## 2. Diagrams (deterministic)

- TikZ compiled server-side to self-contained SVG (ADR-006), templated SUVAT
  motion diagram (ADR-007); print-safe vector PDF at any zoom.
- The engine's own `diagram` payload survives the Zod boundary
  (`lib/engine/sympy-data.ts`).

**Check:** `npx vitest run lib/tikz lib/engine/sympy-data.test.ts`

## 3. Interactive coaching (Application-as-Teacher)

- `/learn`: three checked steps (equation MCQ → substitution fields →
  tolerance-checked answer), all validated against `sympy_data.steps`.
- Misconception classifier over structured inputs: wrong-equation,
  swapped-variables, sign-error, unit-slip, arithmetic-slip (+ generic
  value-slip fallback), each with a hand-authored Thai micro-explanation.
- Escalating hints (nudge → targeted → worked step) and isomorphic re-roll
  (same split, fresh seed).
- Attempt records in the C4 shape `(questionKey, step, input, errorType,
  hintsUsed, solved)`; persistence to Supabase is explicit future work.

**Check:** `npx vitest run features/coach` and a manual scripted run:
choose a wrong equation on purpose → the hint names the actual mistake.

## 4. Engine service

- FastAPI service (jotelab-ai repo): `/generate`, `/verify`, `/chain`, all
  behind `X-Engine-Api-Key`, every response harness-verified at the source.

**Check:** `pytest tests/test_service.py` in jotelab-ai (12 tests).

## 5. Benchmarks

- Engine side: `python -m benchmarks run` (jotelab-ai) — Data Fidelity at
  source, chain fidelity, diagram coverage; deterministic output.
- Coach side: `npx vitest run features/coach/classification-benchmark.test.ts`
  — ≥100 scripted wrong-step submissions, accuracy table written to
  `benchmarks/results/coaching-effectiveness.md`.

## Explicit cut list (mirrored in the report as future work)

Circuits template · LLM-generated TikZ · waves/thermo/dynamics · gamification
(skill tree, XP, streaks) · free-form equation input in coaching · coach
persistence + progress view · teacher human-in-the-loop session (replaced by
the student pilot).

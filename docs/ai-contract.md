# AI generation contract

What the model is asked for, what it is allowed to produce, and what happens
when it gets something wrong. The model **never computes**: for engine-backed
lessons every number is supplied to the prompt from `sympy_data`, and the
model's job is Thai prose (and, historically, TikZ — now engine-owned).

## Input

- Lesson/topic, difficulty, given/target variables, optional scenario context
  (`features/generate/schemas.ts` → `generateWorksheetInputSchema`).
- For engine-backed lessons (`lib/engine/topics.ts`): the verified
  `sympy_data` payload from the engine service
  (`lib/ai/generate-engine-question.ts` builds the prompt around it).

## Output

- Structured output parsed with Zod (`modelCalculationOutputSchema` in
  `features/generate/schemas.ts`): question text segmented as
  `text` / `katex` / `tikz` so prose, math, and diagram code never mix.
- Assembly (`lib/engine/assemble-question.ts`) takes givens, target, steps,
  and final answer **from `sympy_data`**, not from the model output.

## Failure policy (in order)

1. **Schema failure** — output that does not parse is a retriable model error
   (`lib/ai/generation-errors.ts` maps every failure to a typed code).
2. **Data Fidelity failure** — `lib/ai/data-fidelity.ts` compares every
   number/unit in the Thai text against `sympy_data`; mismatch → retry with
   the violation named; repeated failure → the credit reservation is
   **refunded**, never a silently-wrong worksheet.
3. **Engine failure** — `EngineError` from `lib/engine/client.ts` fails the
   reservation and refunds; the app never falls back to LLM-computed numbers.

## Providers

`lib/ai/client.ts` selects the provider. Gemini is primary; the Qwen 3.5
fine-tune track is presented as a benchmarked comparison (fallback decision
recorded 2026-07-29 in DEVELOPMENT_PLAN). `E2E_STUB_GENERATION` swaps in a
deterministic stub (`lib/ai/e2e-stub-question.ts`) so CI needs no keys.

## The coaching exception

The coach (`features/coach/`) uses **no model at all**: its Thai problem
statement is assembled deterministically from the givens, and every judgment
is rule-based against `sympy_data`. LLM phrasing there is optional future
polish, never a judge.

## How to test

```bash
npx vitest run lib/ai features/generate    # schema, fidelity, error mapping
npm run test:generate-question             # live one-shot against real keys
```

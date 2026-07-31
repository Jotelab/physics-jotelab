# Jotelab — Product

## Vision

Jotelab is a Thai-language physics learning tool built on one non-negotiable
idea, stated as two invariants:

1. **Every number a student sees comes from the symbolic engine (SymPy). The
   LLM never computes — it only phrases Thai prose and emits TikZ.**
2. **The app itself teaches: when a student solves a problem in-app, the
   symbolic engine — not the AI — judges every step, pinpoints the
   misconception, and the LLM only phrases the explanation.**

Invariant 2 is possible because invariant 1 holds: the engine's `sympy_data`
payload already carries the exact per-step solution (equation, substitution,
result), so the system knows the correct path *before* the student starts.
That is the capability generic AI tutors cannot offer.

## Users

- **Teachers** generate printable worksheets (A4, vector PDF) with verified
  numbers, worked solutions, and deterministic diagrams.
- **Students** practice on `/learn`: an engine-generated problem solved in
  three checked steps, with misconception-targeted hints instead of instant
  answer reveals — and a *next* problem chosen from whatever the classifier
  just diagnosed, so the app teaches rather than only grades.

## Core flows

| Flow | Route | What guarantees correctness |
| --- | --- | --- |
| Worksheet generation | `/generate` | engine `sympy_data` + runtime Data Fidelity gate (`lib/ai/data-fidelity.ts`) |
| Worksheet library / export | `/library` | stored `sympy_data` travels verbatim; PDF is vector (ADR-006) |
| Coached solve | `/learn` | every structured input checked against `sympy_data.steps` (`features/coach/`) |
| Remediation | `/learn` | the diagnosed misconception becomes the next `/generate` constraint set (`features/coach/remediation.ts`) |

## Risks the design answers

- **LLM hallucination of numbers** → the LLM is never the source of a number;
  mismatches are caught by the fidelity gate, retried, and refunded.
- **AI-judged grading** → grading is rule-based against the engine's known
  solution; explanations are hand-authored Thai (LLM polish optional).
- **Free-form input parsing** → coaching v1 is structured input only
  (MCQ + numeric fields), per the report's own risk note.

## How to test (the invariants, end to end)

```bash
# Invariant 1: numbers originate in the engine and survive to the UI
npx vitest run lib/ai/data-fidelity.test.ts lib/engine

# Invariant 2: the engine-judged coach loop, incl. misconception → next problem
npx vitest run features/coach

# Live: run the engine service (see jotelab-ai/docs/deploy-render.md for the
# production version), set ENGINE_BASE_URL/ENGINE_API_KEY, visit /learn
```

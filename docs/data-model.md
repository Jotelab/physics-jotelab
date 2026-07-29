# Data model

Postgres via Supabase; schema lives in `supabase/migrations/` (the migrations
are the source of truth — this doc is the map, not the territory).

## Core tables

| Table | Purpose | Key migration |
| --- | --- | --- |
| `profiles` | user profile + credit balance | `20260516000000_phase_2_auth_profiles` |
| `worksheets` | a worksheet (header settings, counts, subject) | `20260516*`, `20260612*` |
| `worksheet_questions` | one row per saved question, `sympy_data jsonb` verbatim | `20260609*`, `20260705000000_worksheet_question_sympy_data` |
| `worksheet_variants` | parallel number-sets of a question, own `sympy_data` | `20260615*`, `20260707000000_variant_roll_sympy_data` |
| `credit_reservations` | reserve → complete/refund lifecycle per generation | `20260601000000_credit_reservations` |
| `generation_jobs` | async generation with progress + stuck-job reaping | `20260608*`, `20260627*` |
| `generation_settings` | per-user defaults (variables, difficulty, subject) | `20260524*`, `20260621*` |
| `coaching_attempts` | one row per checked coaching input (step, error type, hints, solved) | `20260729000000_coaching_attempts` |

## `coaching_attempts` (C1.3)

Signed-in students' coached-solve inputs, written through the
`record_coaching_attempt` SECURITY DEFINER RPC (RLS allows `select` of own
rows only; no direct writes). `question_key` is `topic:seed:find` — the engine
is seeded, so the key re-derives the exact question without duplicating
`sympy_data` per attempt. Anonymous `/learn` solves are deliberately not
stored: the coaching surface works with no account, and its attempt log then
lives only in the browser console (`[coach-attempt]`). The account page's
progress card aggregates these rows (`features/coach/progress.ts`).

## Credit rules

Generation is **reserve-first**: `reserve_generate_question_credit` /
`reserve_regenerate_question_credit` (SECURITY DEFINER RPCs, public EXECUTE
revoked) take the credit before any model call; completion RPCs finalize, and
a failed generation refunds through `_refund_credit_reservation_row`. The Data
Fidelity gate's "retry → refund on mismatch" sits on top of this: a question
that cannot be made faithful never costs the user.

## `sympy_data` (the cross-repo contract)

`worksheet_questions.sympy_data` stores the engine payload **verbatim** —
topic, seed, given/find/steps/final_answer (exact-first per ADR-005), plus
`auxiliary` (system templates) and `diagram` (engine-owned figures). The Zod
mirror is `lib/engine/sympy-data.ts`; the Python source of truth is
`jotelab-ai/engine/contract.py`. Two-repo drift is the named risk; keep the
Zod schema in lock-step with `build_sympy_data`.

## Hardening worth knowing about

- JSON payload validation and size limits at the DB boundary
  (`20260516050000`, `20260607000000`).
- Idempotency keys for generation (`20260606000000`) and error-code
  vocabulary (`20260611000000`).
- Subject allowlist — physics only for now (`20260614*`, `20260629000000`).

## How to test

```bash
# Schema-dependent server logic (mocked Supabase client):
npx vitest run features/generate features/worksheet

# Coaching persistence + progress aggregation:
npx vitest run features/coach

# Full coached solve in a browser (stubbed engine, no services needed):
E2E_STUB_GENERATION=true npm run test:e2e:public

# Against a real local stack (requires supabase CLI):
supabase db reset          # applies every migration in order
npm run test:e2e           # Playwright, uses E2E_STUB_GENERATION
```

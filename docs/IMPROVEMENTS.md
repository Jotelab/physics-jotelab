# Improvements

## Bugs

Findings from a focused audit of the Inngest job workers, the generation flow,
and the idempotency/retry logic. Severity and effort (S/M/L) are estimates.

### High

- [x] **High · M** — Regenerate is a silent no-op for 24h after the first regenerate of a question. The idempotency key `regen:{worksheetId}:{questionId}` has no per-click nonce, so a second regenerate short-circuits on the completed `generation_idempotency` row and returns the cached first result (no AI call, no credit charged). [features/generate/utils/idempotency-key.ts:5](../features/generate/utils/idempotency-key.ts#L5) (with [features/generate/generate-question-core.ts:366](../features/generate/generate-question-core.ts#L366)). _Fix:_ fold a fresh client-supplied attempt/nonce into the regenerate key.

- [ ] **High · M** — Any unexpected throw in the worker permanently bricks a worksheet's generation. The Inngest function has no `onFailure` and the worker only marks `failed` for in-band results; after retries are exhausted the row stays `running` and the `generation_jobs_one_active_per_worksheet` unique index blocks all future jobs (no cancel RPC, no TTL cleanup). [lib/inngest/functions/generate-worksheet-questions.ts:8](../lib/inngest/functions/generate-worksheet-questions.ts#L8) (throw source [features/generate/generate-question-core.ts:454](../features/generate/generate-question-core.ts#L454), index [supabase/migrations/20260608000000_generation_jobs.sql:22](../supabase/migrations/20260608000000_generation_jobs.sql#L22)). _Fix:_ add an `onFailure` that sets status `failed`, plus a stuck-job cleanup/cancel path.

### Medium

- [ ] **Med · S** — Duplicate `update_generation_job_progress` overloads risk PostgREST ambiguity (PGRST203). The variant migration adds a 7-arg version without dropping the original 6-arg one, and the standard worker's call matches both. [supabase/migrations/20260615000000_worksheet_variants.sql:852](../supabase/migrations/20260615000000_worksheet_variants.sql#L852) (orphaned original [supabase/migrations/20260608000000_generation_jobs.sql:155](../supabase/migrations/20260608000000_generation_jobs.sql#L155), caller [lib/inngest/run-generation-job-worker.ts:32](../lib/inngest/run-generation-job-worker.ts#L32)). _Fix:_ drop the 6-arg signature.

- [ ] **Med · M** — Variant identity is generated non-deterministically outside Inngest steps. `getOrCreateVariant` calls `crypto.randomUUID()` / `new Date()` in the function body, so the variant `id`/`createdAt` change across replays/retries while per-roll persist steps stay memoized → unstable identity / possible duplicate variant on client merge. [lib/inngest/run-variant-generation-job-worker.ts:59](../lib/inngest/run-variant-generation-job-worker.ts#L59) (invoked at line 187). _Fix:_ mint id/createdAt inside a memoized `step.run`, or derive deterministically from jobId+label.

- [ ] **Med · M** — Append is non-atomic across two RPCs. `extend_worksheet_count` commits the new `question_count` before `enqueue_generation_job`; a failure (e.g. "already active") or a failed Inngest send between them leaves the count inflated with no job to fill it, and retrying inflates it further. [features/generate/generation-job-actions.ts:214](../features/generate/generation-job-actions.ts#L214). _Fix:_ extend + enqueue in one transaction/RPC, or roll back the count on failure.

### Low

- [ ] **Low · S** — Double-cancel on reservation cleanup error. If `cancelGenerateReservation` throws, `reservationActive` is never cleared, so the `catch` cancels again (same shape in regenerate and variant paths). [features/generate/generate-question-core.ts:269](../features/generate/generate-question-core.ts#L269). _Fix:_ set `reservationActive = false` before awaiting the cancel.

- [ ] **Low · S** — Shared poll-abort refs let two polling loops run concurrently. `startGeneration` doesn't guard on `isGeneratingRef`, and `pollJobUntilTerminal` resets the shared `pollAbortRef` on entry, so overlapping calls fight over `setState`. [features/generate/hooks/use-worksheet-generator.ts:210](../features/generate/hooks/use-worksheet-generator.ts#L210) (reset at line 127). _Fix:_ guard `startGeneration`, or use a per-poll abort token.

- [ ] **Low · M** — Orphan worksheet on init failure. `generate_worksheet_init` commits a worksheet row; a later enqueue/Inngest-send failure leaves an empty orphan worksheet (only the job is marked failed). [features/generate/generation-job-actions.ts:128](../features/generate/generation-job-actions.ts#L128). _Fix:_ create + enqueue in one transaction, or delete the worksheet on the failure path.

## Security

Findings from a focused security review (RLS, server-action auth/validation,
client-bundle secrets, SSRF/open-proxy, prompt injection). Severity and effort
(S/M/L) are estimates.

**Scope verified:** I read the actual migrations under `supabase/`. RLS is in
good shape: `profiles`, `worksheets`, `credit_transactions`, `generation_jobs`,
`worksheet_questions`, `credit_reservations`, and `generation_idempotency` all
have RLS enabled with own-row-only `SELECT` (and `worksheets` own-row `DELETE`);
there are **no** `INSERT`/`UPDATE`/`ALL` policies — every write goes through a
`SECURITY DEFINER` RPC that re-derives the profile from `auth.uid()` and checks
worksheet ownership, and RPC `EXECUTE` is revoked from `public`/`anon` (worker
RPCs granted only to `service_role`). The server actions in `features/*/actions.ts`
all `safeParse` input with Zod and call `auth.getUser()` before touching the DB,
relying on that verified RLS to scope by `id`. No RLS gap found. `proxy.ts` and
`lib/supabase/proxy.ts` are Next.js auth/session middleware, **not** HTTP
proxies — there is no outbound fetch to a user-controlled URL, so no SSRF /
open-proxy surface; OAuth `redirectTo` is built only from an allowlisted origin
([lib/supabase/get-request-origin.ts:3](../lib/supabase/get-request-origin.ts#L3)).
The items below are hardening / defense-in-depth, not active exploits.

### Medium

- [ ] **Med · S** — Generation worker impersonates the profile from the *event payload* rather than the authoritative job row. `runGenerationJobWorker` mints a user-scoped JWT via `createClientForProfile(event.data.profileId)` instead of `generation_jobs.user_id` (already loaded via the admin client). Today this fails closed (RLS blocks a mismatched profile/worksheet pair) and is gated by the Inngest signature, but it makes a privilege-escalation primitive trust an unauthenticated field. [lib/inngest/run-generation-job-worker.ts:96](../lib/inngest/run-generation-job-worker.ts#L96) (mint at [lib/supabase/user-client.ts:45](../lib/supabase/user-client.ts#L45)). _Fix:_ derive `profileId` from the loaded `job.user_id`, not the event.

- [ ] **Med · S** — `createClientForProfile` signs a valid `authenticated` JWT for *any* `profileId` with no caller authorization, so its safety rests entirely on (a) every caller passing a trusted id and (b) Inngest webhook signature verification. The `serve()` handler and `new Inngest({ id })` client don't pin `signingKey`/`isDev`, relying on env auto-detection — if `INNGEST_SIGNING_KEY` is unset in production, `/api/inngest` would accept unauthenticated invocations that mint user JWTs and spend credits. [app/api/inngest/route.ts:6](../app/api/inngest/route.ts#L6) (client [lib/inngest/client.ts:3](../lib/inngest/client.ts#L3)). _Fix:_ pin/assert the signing key and fail fast in production if absent.

### Low

- [ ] **Low · S** — Secret-bearing server modules lack the `server-only` import guard. `admin.ts` (`SUPABASE_SERVICE_ROLE_KEY`), `user-client.ts` (`SUPABASE_JWT_SECRET`), and `ai/client.ts` (provider API keys) read secrets but don't `import "server-only"` like [features/library/data.ts](../features/library/data.ts) and [features/auth/get-user-profile.ts](../features/auth/get-user-profile.ts) do. No client component imports them today (verified), so this only guards against a future accidental client import. [lib/supabase/admin.ts:7](../lib/supabase/admin.ts#L7), [lib/supabase/user-client.ts:24](../lib/supabase/user-client.ts#L24), [lib/ai/client.ts:23](../lib/ai/client.ts#L23). _Fix:_ add `import "server-only"` to each.

- [ ] **Low · S** — Best-effort job-fail cleanup uses the service-role (RLS-bypassing) client in a request path. `markGenerationJobFailed` flips `generation_jobs.status` to `failed` by `jobId` with no ownership check. The `jobId` is server-minted in the same action (not user-supplied), so no IDOR today, but it would become one if the call were ever reached with a client-influenced id. [features/generate/generation-job-actions.ts:46](../features/generate/generation-job-actions.ts#L46), [features/generate/variant-actions.ts:49](../features/generate/variant-actions.ts#L49). _Fix:_ scope the update to the known owner or route via a user-scoped path.

- [ ] **Low · S** — Prompt injection: user-controlled `lesson` / `scenario` (and the existing question text on regenerate) are interpolated unescaped into the generation prompt. Impact is contained — inputs are length-bounded by Zod (`MAX_LESSON_LEN`/`MAX_SCENARIO_LEN`), output is constrained by `generateObject` + `generatedQuestionSchema` + normalize + re-parse, there is no tool use, and the result is stored only in the user's own worksheet (no cross-tenant or exfil channel) — so worst case a user degrades their own output. [lib/ai/generate-question.ts:40](../lib/ai/generate-question.ts#L40) (regenerate [lib/ai/regenerate-question.ts:36](../lib/ai/regenerate-question.ts#L36)). _Fix:_ delimit user content as clearly-marked untrusted data and keep the schema/validation guarantees.

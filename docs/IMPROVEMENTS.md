# Improvements

## Bugs

Findings from a focused audit of the Inngest job workers, the generation flow,
and the idempotency/retry logic. Severity and effort (S/M/L) are estimates.

### High

- [x] **High · M** — Regenerate is a silent no-op for 24h after the first regenerate of a question. The idempotency key `regen:{worksheetId}:{questionId}` has no per-click nonce, so a second regenerate short-circuits on the completed `generation_idempotency` row and returns the cached first result (no AI call, no credit charged). [features/generate/utils/idempotency-key.ts:5](../features/generate/utils/idempotency-key.ts#L5) (with [features/generate/generate-question-core.ts:366](../features/generate/generate-question-core.ts#L366)). _Fix:_ fold a fresh client-supplied attempt/nonce into the regenerate key.

- [x] **High · M** — Any unexpected throw in the worker permanently bricks a worksheet's generation. The Inngest function has no `onFailure` and the worker only marks `failed` for in-band results; after retries are exhausted the row stays `running` and the `generation_jobs_one_active_per_worksheet` unique index blocks all future jobs (no cancel RPC, no TTL cleanup). [lib/inngest/functions/generate-worksheet-questions.ts:8](../lib/inngest/functions/generate-worksheet-questions.ts#L8) (throw source [features/generate/generate-question-core.ts:454](../features/generate/generate-question-core.ts#L454), index [supabase/migrations/20260608000000_generation_jobs.sql:22](../supabase/migrations/20260608000000_generation_jobs.sql#L22)). _Fix:_ add an `onFailure` that sets status `failed`, plus a stuck-job cleanup/cancel path.

### Medium

- [x] **Med · S** — Duplicate `update_generation_job_progress` overloads risk PostgREST ambiguity (PGRST203). The variant migration adds a 7-arg version without dropping the original 6-arg one, and the standard worker's call matches both. [supabase/migrations/20260615000000_worksheet_variants.sql:852](../supabase/migrations/20260615000000_worksheet_variants.sql#L852) (orphaned original [supabase/migrations/20260608000000_generation_jobs.sql:155](../supabase/migrations/20260608000000_generation_jobs.sql#L155), caller [lib/inngest/run-generation-job-worker.ts:32](../lib/inngest/run-generation-job-worker.ts#L32)). _Fix:_ drop the 6-arg signature.

- [x] **Med · M** — Variant identity is generated non-deterministically outside Inngest steps. `getOrCreateVariant` calls `crypto.randomUUID()` / `new Date()` in the function body, so the variant `id`/`createdAt` change across replays/retries while per-roll persist steps stay memoized → unstable identity / possible duplicate variant on client merge. [lib/inngest/run-variant-generation-job-worker.ts:59](../lib/inngest/run-variant-generation-job-worker.ts#L59) (invoked at line 187). _Fix:_ mint id/createdAt inside a memoized `step.run`, or derive deterministically from jobId+label.

- [x] **Med · M** — Append is non-atomic across two RPCs. `extend_worksheet_count` commits the new `question_count` before `enqueue_generation_job`; a failure (e.g. "already active") or a failed Inngest send between them leaves the count inflated with no job to fill it, and retrying inflates it further. [features/generate/generation-job-actions.ts:214](../features/generate/generation-job-actions.ts#L214). _Fix:_ extend + enqueue in one transaction/RPC, or roll back the count on failure.

### Low

- [x] **Low · S** — Double-cancel on reservation cleanup error. If `cancelGenerateReservation` throws, `reservationActive` is never cleared, so the `catch` cancels again (same shape in regenerate and variant paths). [features/generate/generate-question-core.ts:269](../features/generate/generate-question-core.ts#L269). _Fix:_ set `reservationActive = false` before awaiting the cancel.

- [x] **Low · S** — Shared poll-abort refs let two polling loops run concurrently. `startGeneration` doesn't guard on `isGeneratingRef`, and `pollJobUntilTerminal` resets the shared `pollAbortRef` on entry, so overlapping calls fight over `setState`. [features/generate/hooks/use-worksheet-generator.ts:210](../features/generate/hooks/use-worksheet-generator.ts#L210) (reset at line 127). _Fix:_ guard `startGeneration`, or use a per-poll abort token.

- [x] **Low · M** — Orphan worksheet on init failure. `generate_worksheet_init` commits a worksheet row; a later enqueue/Inngest-send failure leaves an empty orphan worksheet (only the job is marked failed). [features/generate/generation-job-actions.ts:128](../features/generate/generation-job-actions.ts#L128). _Fix:_ create + enqueue in one transaction, or delete the worksheet on the failure path.

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

- [x] **Med · S** — Generation worker impersonates the profile from the *event payload* rather than the authoritative job row. `runGenerationJobWorker` mints a user-scoped JWT via `createClientForProfile(event.data.profileId)` instead of `generation_jobs.user_id` (already loaded via the admin client). Today this fails closed (RLS blocks a mismatched profile/worksheet pair) and is gated by the Inngest signature, but it makes a privilege-escalation primitive trust an unauthenticated field. [lib/inngest/run-generation-job-worker.ts:96](../lib/inngest/run-generation-job-worker.ts#L96) (mint at [lib/supabase/user-client.ts:45](../lib/supabase/user-client.ts#L45)). _Fix:_ derive `profileId` from the loaded `job.user_id`, not the event.

- [x] **Med · S** — `createClientForProfile` signs a valid `authenticated` JWT for *any* `profileId` with no caller authorization, so its safety rests entirely on (a) every caller passing a trusted id and (b) Inngest webhook signature verification. The `serve()` handler and `new Inngest({ id })` client don't pin `signingKey`/`isDev`, relying on env auto-detection — if `INNGEST_SIGNING_KEY` is unset in production, `/api/inngest` would accept unauthenticated invocations that mint user JWTs and spend credits. [app/api/inngest/route.ts:6](../app/api/inngest/route.ts#L6) (client [lib/inngest/client.ts:3](../lib/inngest/client.ts#L3)). _Fix:_ pin/assert the signing key and fail fast in production if absent.

### Low

- [x] **Low · S** — Secret-bearing server modules lack the `server-only` import guard. `admin.ts` (`SUPABASE_SERVICE_ROLE_KEY`), `user-client.ts` (`SUPABASE_JWT_SECRET`), and `ai/client.ts` (provider API keys) read secrets but don't `import "server-only"` like [features/library/data.ts](../features/library/data.ts) and [features/auth/get-user-profile.ts](../features/auth/get-user-profile.ts) do. No client component imports them today (verified), so this only guards against a future accidental client import. [lib/supabase/admin.ts:7](../lib/supabase/admin.ts#L7), [lib/supabase/user-client.ts:24](../lib/supabase/user-client.ts#L24), [lib/ai/client.ts:23](../lib/ai/client.ts#L23). _Fix:_ add `import "server-only"` to each.

- [x] **Low · S** — Best-effort job-fail cleanup uses the service-role (RLS-bypassing) client in a request path. `markGenerationJobFailed` flips `generation_jobs.status` to `failed` by `jobId` with no ownership check. The `jobId` is server-minted in the same action (not user-supplied), so no IDOR today, but it would become one if the call were ever reached with a client-influenced id. [features/generate/generation-job-actions.ts:46](../features/generate/generation-job-actions.ts#L46), [features/generate/variant-actions.ts:49](../features/generate/variant-actions.ts#L49). _Fix:_ scope the update to the known owner or route via a user-scoped path.

- [x] **Low · S** — Prompt injection: user-controlled `lesson` / `scenario` (and the existing question text on regenerate) are interpolated unescaped into the generation prompt. Impact is contained — inputs are length-bounded by Zod (`MAX_LESSON_LEN`/`MAX_SCENARIO_LEN`), output is constrained by `generateObject` + `generatedQuestionSchema` + normalize + re-parse, there is no tool use, and the result is stored only in the user's own worksheet (no cross-tenant or exfil channel) — so worst case a user degrades their own output. [lib/ai/generate-question.ts:40](../lib/ai/generate-question.ts#L40) (regenerate [lib/ai/regenerate-question.ts:36](../lib/ai/regenerate-question.ts#L36)). _Fix:_ delimit user content as clearly-marked untrusted data and keep the schema/validation guarantees.

## Maintainability

Findings on duplicated logic, oversized files, weak typing, and test gaps.
Severity and effort (S/M/L) are estimates. The TypeScript surface is otherwise
clean — there is exactly one `as unknown as` and zero `: any` / `as any` in
non-test source.

### High

- [x] **High · M** — The reserve→generate→complete→cancel flow is triplicated. `generateQuestionForWorksheet`, `regenerateQuestionForWorksheet`, and `generateVariantRollForQuestion` each re-implement the same skeleton (parse reserve failure, branch on `completed`/`failed`/active, `reservationActive` bookkeeping, cancel-on-throw). Bugs get fixed in one copy and not the others. [features/generate/generate-question-core.ts:243](../features/generate/generate-question-core.ts#L243) (regenerate [generate-question-core.ts:381](../features/generate/generate-question-core.ts#L381), variant [generate-variant-core.ts:178](../features/generate/generate-variant-core.ts#L178)). _Fix:_ extract a `withCreditReservation(reserve, generate, complete, cancel)` helper.

### Medium

- [x] **Med · M** — The two Inngest workers duplicate their whole scaffolding. `runStandardGenerationJobWorker` and `runVariantGenerationJobWorker` repeat mark-running / load-job / load-worksheet / per-item loop / credit-exhaust fan-out / finalize, plus near-identical `updateJob` vs `updateVariantJob` RPC wrappers. [lib/inngest/run-generation-job-worker.ts:89](../lib/inngest/run-generation-job-worker.ts#L89) (variant [run-variant-generation-job-worker.ts:79](../lib/inngest/run-variant-generation-job-worker.ts#L79)). _Fix:_ factor a generic job-runner parameterized by the per-item work function and progress serializer.

- [x] **Med · M** — No unit coverage on the job-orchestration or auth critical paths. `generate-question-core` and the credit/limit utils are tested, but the workers (retry, skip, credit-exhaust, partial/failed transitions) have no `*.test.ts`, and `features/auth/actions.ts` (sign-in/out) is untested. [lib/inngest/run-generation-job-worker.ts:1](../lib/inngest/run-generation-job-worker.ts#L1), [lib/inngest/run-variant-generation-job-worker.ts:1](../lib/inngest/run-variant-generation-job-worker.ts#L1), [features/auth/actions.ts:1](../features/auth/actions.ts#L1). _Fix:_ test the workers against a fake `GenerationJobStep` + stubbed core.

- [x] **Med · M** — `worksheet-config-panel.tsx` is a 480-line presentational component with a ~35-field props interface (prop-drilling). Every new control threads another callback prop through the parent. [features/generate/components/worksheet-config-panel.tsx:22](../features/generate/components/worksheet-config-panel.tsx#L22). _Fix:_ group related props into objects or provide form state via context.

### Low

- [x] **Low · S** — Only unsafe cast in the codebase: `step as unknown as GenerationJobStep` papers over a real type mismatch between Inngest's `step` and the internal step interface. [lib/inngest/functions/generate-worksheet-questions.ts:26](../lib/inngest/functions/generate-worksheet-questions.ts#L26). _Fix:_ define `GenerationJobStep` as the subset Inngest already satisfies, or wrap with a typed adapter.

- [x] **Low · S** — `getWorksheetForProfile` (select id/user_id/settings, compare `user_id`) is copy-pasted between the generate core and the variant core with slightly different column lists. [features/generate/generate-question-core.ts:75](../features/generate/generate-question-core.ts#L75), [features/generate/generate-variant-core.ts:34](../features/generate/generate-variant-core.ts#L34). _Fix:_ share one ownership-load helper.

- [x] **Low · M** — JSON/DB rows are typed by hand (`generation_settings: unknown`, `variants: unknown`) and read back through ad-hoc `data as X` casts with no generated Supabase types; `get-user-profile.ts` returns `data as UserProfile` with no runtime validation. [features/auth/get-user-profile.ts:18](../features/auth/get-user-profile.ts#L18), [features/generate/utils/fetch-worksheet-questions.ts:44](../features/generate/utils/fetch-worksheet-questions.ts#L44). _Fix:_ generate `Database` types from Supabase and/or Zod-validate the profile row.

## Scalability

Findings on behavior under load: the generation pipeline, Inngest concurrency,
Supabase access patterns, and credit checks under concurrency. Severity and
effort (S/M/L) are estimates. (Indexes for the hot access paths — `worksheet_questions(worksheet_id, question_order)`, `generation_jobs(worksheet_id)` partial-active, `credit_reservations` unique active slots — already exist, so the items below are about request volume and serialization, not missing indexes.)

### High

- [x] **High · M** — The standard worker re-reads *all* of a worksheet's questions ~3× per order → roughly O(N²) row transfer for an N-question worksheet. Inside each `generate-order-${order}` step it calls `loadWorksheetQuestionsForProfile` (full fetch), then `generateQuestionForWorksheet` calls `fetchWorksheetQuestions` again, then a third `reloaded` fetch after save. [lib/inngest/run-generation-job-worker.ts:156](../lib/inngest/run-generation-job-worker.ts#L156) (reload [run-generation-job-worker.ts:178](../lib/inngest/run-generation-job-worker.ts#L178), inner [generate-question-core.ts:183](../features/generate/generate-question-core.ts#L183)). _Fix:_ pass the already-loaded questions into the core; only fetch the prior-context slice (`question_order < order`).

### Medium

- [x] **Med · S** — No global/account-level Inngest concurrency cap. `concurrency.key = event.data.worksheetId, limit 1` only serializes a single worksheet; the number of worksheets generating in parallel is unbounded, so a burst fans out into unbounded concurrent model calls and Supabase connections (provider rate-limit / pool exhaustion). [lib/inngest/functions/generate-worksheet-questions.ts:13](../lib/inngest/functions/generate-worksheet-questions.ts#L13). _Fix:_ add a second account- or app-scoped concurrency limit.

- [x] **Med · M** — Variant generation is fully serial: `labels.length * to_order` rolls, one model call per Inngest step, in a single run. A 40-question worksheet × 3 variants = 120 sequential AI calls (minutes-long job, single point of stall). [lib/inngest/run-variant-generation-job-worker.ts:117](../lib/inngest/run-variant-generation-job-worker.ts#L117) (loop [run-variant-generation-job-worker.ts:149](../lib/inngest/run-variant-generation-job-worker.ts#L149)). _Fix:_ fan rolls out across parallel steps / `step.run` batches with bounded concurrency.

- [x] **Med · S** — No scheduled sweep for expired reservations or stuck jobs. `cleanup_expired_credit_reservations()` is granted to `service_role` but nothing invokes it on a schedule; only lazy per-user cleanup runs inside `reserve_*`. Reservations from users who never return accumulate, and a stuck `running` job is never reaped, so the `generation_jobs_one_active_per_worksheet` partial-unique index blocks the worksheet permanently (see Bugs §High). [supabase/migrations/20260601000000_credit_reservations.sql:132](../supabase/migrations/20260601000000_credit_reservations.sql#L132). _Fix:_ add a pg_cron / Inngest cron to sweep both.

- [x] **Med · M** — Generation polling is full-fetch-per-tick. The client polls every 2s and each `getGenerationJobAction` runs job + worksheet + profile selects **plus a full `fetchWorksheetQuestions`**; with many concurrent generations this multiplies DB load and stacks on the O(N²) reload above. [features/generate/hooks/use-worksheet-generator.ts:22](../features/generate/hooks/use-worksheet-generator.ts#L22) (server [generation-job-actions.ts:325](../features/generate/generation-job-actions.ts#L325)). _Fix:_ return only questions newer than the client's last-seen order, or push via Supabase Realtime with polling backoff.

### Low

- [x] **Low · M** — Per-user credit serialization. Every `reserve_*_credit` takes `select … from profiles … for update` and runs the full `_cleanup_expired_reservations_for_user` loop, so all of one user's concurrent generate/regenerate/variant operations serialize on the profile row and re-scan their reservations each call. Correct, but a throughput ceiling per user. [supabase/migrations/20260601000000_credit_reservations.sql:185](../supabase/migrations/20260601000000_credit_reservations.sql#L185). _Fix:_ keep the lock narrow; gate the cleanup behind an "any expired?" probe instead of an unconditional loop.

## Expandability

Findings on the cost of adding a subject beyond physics. Severity and effort
(S/M/L) are estimates. The `subject` column is threaded end-to-end, but every
layer downstream of it assumes physics; there is no subject registry or
extension point.

### High

- [x] **High · M** — `subject` is pinned to a single literal at every layer, so a new subject can't even be persisted without coordinated edits: Zod `z.literal("physics")`, the DB `check (subject = 'physics')` + `generate_worksheet_init` reject, and the form default `subject: "physics"`. [features/generate/schemas.ts:22](../features/generate/schemas.ts#L22), [supabase/migrations/20260614000000_physics_only_subject.sql:7](../supabase/migrations/20260614000000_physics_only_subject.sql#L7), [features/generate/hooks/use-worksheet-config-form.ts:81](../features/generate/hooks/use-worksheet-config-form.ts#L81). _Fix:_ make `subjectSchema` an enum and relax the constraint/RPC to an allowlist.

- [x] **High · L** — Lesson, scenario, and variable content is 100% physics and not keyed by subject. `LESSON_PRESET_IDS`, `SCENARIO_CONTENT`, `VARIABLE_PRESETS` (`phys-*` ids) and the entire `variable-compatibility` formula graph have no subject dimension — a new subject has nowhere to register its topics/variables. [features/generate/data/generation-presets.ts:3](../features/generate/data/generation-presets.ts#L3), [features/generate/data/variable-compatibility.ts:7](../features/generate/data/variable-compatibility.ts#L7). _Fix:_ introduce a `Record<Subject, SubjectContentPack>` registry (lessons, scenarios, variables, compatibility) and select by subject.

### Medium

- [x] **Med · L** — The generated-question schema is calculation-shaped and can't represent non-quantitative subjects. `generatedQuestionSchema` mandates numeric/string `given_values`, a single `target_variable`, and `solution.steps`/`final_answer` — fine for physics/math, but multiple-choice, labeling, or essay subjects don't fit. [features/generate/schemas.ts:88](../features/generate/schemas.ts#L88). _Fix:_ model question formats as a discriminated union keyed by subject/format.

- [ ] **Med · M** — Prompt construction hardcodes physics-style "calculation question" framing with no subject hook. `buildGenerationPrompt` ("high-school calculation question"), the variant prompt, and `prompt-rules` math-complexity rules all assume numeric givens. [lib/ai/generate-question.ts:36](../lib/ai/generate-question.ts#L36) (variant [variant-question.ts:46](../lib/ai/variant-question.ts#L46), rules [prompt-rules.ts:6](../lib/ai/prompt-rules.ts#L6)). _Fix:_ inject a subject-provided prompt fragment / rule set from the content pack.

### Low

- [ ] **Low · S** — Hardcoded physics naming in shared/global spots: Inngest app id `"physics-jotelab"` and the unconditional `subjects.physics` i18n label in the workspace summary. [lib/inngest/client.ts:3](../lib/inngest/client.ts#L3), [features/generate/hooks/use-generate-workspace.ts:138](../features/generate/hooks/use-generate-workspace.ts#L138). _Fix:_ derive the display label from `worksheet.subject` once subjects are pluralized.

## Neuro-Symbolic Integration

Findings from comparing this app against `../jotelab-ai` (the constrained SymPy
symbolic engine) and the Jotelab neuro-symbolic design. Severity and effort
(S/M/L) are estimates. The engine emits the authoritative `sympy_data` contract
(numbers, units, worked steps, exact-valued answer — verified at Data Fidelity =
100%), but it is **not** wired into the app, so today the LLM — not the engine —
produces every number a student sees, which inverts the project's core claim.

### High

- [ ] **High · L** — The app breaks the core neuro-symbolic invariant: the LLM produces the numbers, not the symbolic engine. `generateWorksheetQuestion` asks `generateObject` for the whole question — `given_values`, `solution.steps`, and `final_answer` — so the model invents and computes every value a student sees (the exact "AI hallucination" Jotelab exists to defeat). The SymPy engine (`../jotelab-ai`, the `sympy_data` source of truth) is not in the loop. [lib/ai/generate-question.ts:66](../lib/ai/generate-question.ts#L66) (schema [features/generate/schemas.ts:88](../features/generate/schemas.ts#L88)). _Fix:_ split generation into two stages — SymPy emits `sympy_data` (numbers/steps/answer), the LLM only phrases it in Thai — and shrink the LLM schema to phrasing-only.

### Medium

- [ ] **Med · M** — No host or call path for the Python engine from the Node worker. The app runs on Vercel/Node; `../jotelab-ai` is Python + SymPy exposing `engine.loop.generate(...) → sympy_data` plus a `python -m engine --json` CLI, but nothing in the Inngest generation worker invokes it. [lib/inngest/run-generation-job-worker.ts:1](../lib/inngest/run-generation-job-worker.ts#L1). _Fix:_ expose the engine as a small FastAPI service (or Vercel Python function) returning the `sympy_data` contract, and `fetch` it from the worker before the LLM phrasing call.

- [ ] **Med · M** — No `sympy_data` / `ai_structured_data` separation in the data model. `worksheet_questions` stores only LLM-shaped fields (`given_values`, `solution`); the proposal's authoritative `sympy_data` jsonb — the audit trail and Data Fidelity oracle — has nowhere to live, so engine output cannot be persisted as the source of truth. [features/generate/schemas.ts:88](../features/generate/schemas.ts#L88). _Fix:_ add a `sympy_data` jsonb column as the source of truth and derive/validate the display fields from it.

- [ ] **Med · S** — No production Data Fidelity gate. Nothing compares the numbers in the model's rendered text against an authoritative source before persisting, so a model that "corrects" or drifts a value ships silently. [lib/ai/generate-question.ts:72](../lib/ai/generate-question.ts#L72). _Fix:_ after phrasing, assert every number/unit in the output appears in `sympy_data`; treat a mismatch as a failed generation and re-roll (bounded).

### Low

- [ ] **Low · L** — Topic-model mismatch between the free-form UI and the templated engine. The app takes free-form `lesson` / `scenario` / `given_variables` across all of "physics"; the engine works in `topic` + `given`/`find` templates and currently covers SUVAT only, so the two do not map 1:1. [features/generate/data/generation-presets.ts:3](../features/generate/data/generation-presets.ts#L3). _Fix:_ roll SUVAT out end-to-end behind a flag first, mapping presets → engine topics via a subject/topic registry (see Expandability §High).

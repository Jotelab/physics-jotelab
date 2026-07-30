# Remediation log — 2026-07-31 session

Working state for the NSC 2026 software remediation (priorities P0–P4).
Every claim below was observed, not assumed; commands are re-runnable.

## Branches

| Branch | Repo | Contents |
|---|---|---|
| `fix/p1-e2e-ci-hygiene` | physics-jotelab | P1: E2E auth fix, loud CI, lockfile hygiene, LICENSE |
| `p0-demo-hardening` (stacked on P1) | physics-jotelab | P0: outage legibility + drill + runbook; P2: benchmark harnesses; P3: provenance chips |
| `p4-engine-clean-instances` | jotelab-ai | P4: pivot re-roll for weak cells + regenerated sweep |

## P0 — demo survival

- Engine Docker artifact **verified locally**: honours injected `$PORT`,
  `/health` lists 11 topics, 401 without `X-Engine-Api-Key`, seed 42 →
  `v = 9 m/s` exact. `render.yaml` blueprint is deploy-ready.
- **Outage contract now provable**: dedicated `ENGINE_UNAVAILABLE` failure code,
  Thai copy promising the refund, skipped slots localized via failure codes.
  Automated drill (`e2e/outage/engine-outage.spec.ts`) drives the real path
  against a dead engine in Thai locale: asserts the Thai message, no leaked
  internals, and the credit balance restored. Observed passing: `2 passed (51s)`.
- **Found + fixed en route**: `generate-engine-question.ts` flattened
  `EngineError` into a plain `Error`, downgrading outages to the generic
  failure copy; real generation hard-requires `INNGEST_EVENT_KEY`
  (added `GENERATION_INLINE=true` as the documented dev/test bypass).
- **Blocked on credentials** (nothing on this machine can do these):
  Render deploy, Vercel env (`ENGINE_BASE_URL`, `ENGINE_API_KEY`,
  `GOOGLE_GENERATIVE_AI_API_KEY`, `INNGEST_*`), production judge dry-run.
  Step-by-step: `docs/demo-runbook.md`.

## P1 — correctness (done, observed)

- `apply-test-user-session.ts` no longer passes `url`+`domain`+`path` to
  `addCookies`; all 4 authenticated specs run. Full suite: **16 passed**.
- `E2E_EXPECT_AUTH=true` fails loudly when creds are missing (observed exit 1);
  CI runs authenticated E2E on every push to protected branches.
- Lockfiles: only `pnpm-lock.yaml` remains; unused `vercel` dep removed;
  `pnpm install --frozen-lockfile` passes (10.6s). MIT `LICENSE` added
  (assumption: MIT, © 2026 Jotelab Team — swap if the team prefers).

## P2 — benchmarks (harnesses ready; real runs blocked on the Google key)

- `benchmarks/prose-fidelity.test.ts` — engine → production phrasing prompt →
  `checkDataFidelity`; writes prose-data-fidelity.md (first-pass + after-retry,
  per cell, failure modes), schema-adherence.md, raw JSONL. Verified to reach
  the local engine and refuse to write results without a model key.
- `benchmarks/llm-judge.test.ts` — Thai fluency + physical plausibility (1–5),
  judge model distinct from generator, human-ratings drop-in for the
  agreement comparison the report's expert-equivalence claim needs.
- **No numbers exist yet — none are claimed.** One command each once
  `GOOGLE_GENERATIVE_AI_API_KEY` is available (see file headers).

## P3 — invariant honesty (done, observed)

Provenance chip on every question, derived from `sympy_data` presence:
"เอนจินตรวจสอบแล้ว" vs amber "AI แต่งโจทย์ — ตัวเลขไม่ผ่านการตรวจโดยเอนจิน".
Covers preview, library, and both print/PDF paths via the shared
`WorksheetPreview`. Deliberately did **not** restrict generation to
engine-backed lessons: master wires only `motion-1d`, so a restriction would
gut every other lesson.

## P4 — engine weak cells

Root cause: inverse splits (find under a square root — e.g. free-fall
`{u,g,h}→t`, two-phase-ascent `{a,g,H}→t1`) almost never roll a clean answer
from randomly sampled givens. Fix: **pivot re-roll** in `engine/loop.py` —
sample the answer from its own range (integer ⇒ clean), derive one given by
solving the swapped split, accept only if the derived given is
sampler-shaped (integer, in range), then run the *unchanged* forward path so
steps/root-selection/fidelity gates are identical. Deterministic (disjoint
seed space), never derives a pinned given. Spot-check on previously failing
cells: two-phase-ascent `{a,g,H}→t1` hard and `{t1,g,H}→a` hard, free-fall
`{u,g,h}→t` and `{v,g,h}→u` medium — **5/5 seeds each, previously ~25–85%**.

**Full regenerated sweep** (`python -m benchmarks run`, 1080 topic instances +
45 chain instances): **every cell 1.0000** — topics 1080/1080 ok (baseline
overall 0.9537; two-phase-ascent hard was 0.2500, medium 0.5000; free-fall
medium 0.8500, hard 0.9000), chains 45/45, 0 fidelity errors. Engine suite:
345 passed, 2 skipped (incl. 4 new pivot tests) in 4:19.

## How to test (everything at once)

```bash
# web (worktree of physics-jotelab, branch p0-demo-hardening)
npx -y pnpm@11.5.2 install --frozen-lockfile
npx vitest run && npx eslint . && npx next build
set -a; source .env.local; set +a; npx playwright test          # 16 passed
E2E_ENGINE_OUTAGE=true E2E_STUB_GENERATION=false GENERATION_INLINE=true \
ENGINE_BASE_URL=http://127.0.0.1:59999 ENGINE_API_KEY=dead-key \
npx playwright test --project=setup --project=engine-outage      # 2 passed

# engine (worktree of jotelab-ai, branch p4-engine-clean-instances)
.venv/bin/python -m pytest -q
.venv/bin/python -m benchmarks run
```

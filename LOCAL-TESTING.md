# Local test clone — no Supabase, no cloud dashboards

This is a sandbox clone of `physics-jotelab` (origin points at the GitHub
repo) preconfigured via `.env.local` to run with **zero external services**:
no Supabase project, no Render engine, no Vercel, no AI keys.

This clone sits on the local branch **`local-testing`**: it includes the dev
password login, which is deliberately **not on `master`** (test-only tooling,
kept on the `feat/dev-password-login` branch upstream). To pull future app
updates: `git fetch origin && git merge origin/master` — and if that merge
removes the dev login (master carries a revert of it), re-apply it with
`git cherry-pick 915ea08`.

## Run it

```bash
npm run dev        # then open http://localhost:3000/learn
```

(Installed with npm; `package-lock.json` shows a local diff because of that —
harmless here. `pnpm install && pnpm dev` works too if you have pnpm.)

## What works with nothing else running

- **`/learn` — the coached solve, fully functional.** `E2E_STUB_GENERATION=true`
  in `.env.local` serves a fixed SUVAT problem (v₀ = 0, a = 2 m/s², t = 5 s →
  v = 10 m/s): equation choice, substitution, answer, wrong-answer hints and
  targeted explanations, worked steps, re-rolls. Attempts log to the browser
  console as `[coach-attempt]`.
- **`/login`** renders; `/` and all dashboard routes redirect there cleanly.

## Logging in — the full app, still fully local

Sign-in normally needs Google OAuth through Supabase. This repo now ships a
**dev password login** instead: a fully local Docker Supabase (no cloud
account, no Google) plus a password form on `/login` gated behind
`DEV_PASSWORD_LOGIN=true`.

One-time installs (the only steps needing sudo — Arch):

```bash
sudo pacman -S docker
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # then log out/in (or newgrp docker)
# Supabase CLI: grab the binary from https://github.com/supabase/cli/releases
# (or: yay -S supabase-bin)
```

Then, in this directory:

```bash
bash scripts/local-dev-stack.sh   # starts Supabase, applies migrations,
                                  # creates the test user, writes .env.local
npm run dev
```

Sign in at http://localhost:3000/login with the credentials the script prints
(`e2e@test.jotelab.local` / `ci-e2e-password`). That unlocks the whole app:
worksheet generation (stubbed content, no AI keys), the library, and the
account page with the coaching progress card. `supabase stop` shuts it down;
`supabase db reset` re-applies migrations after pulling new ones.

Without the Docker stack, the placeholder env still applies: auth routes just
redirect to `/login`; nothing crashes.

## Demoing without the engine

There is no curated-content switch. A demo shows real engine output or it shows
an error — see `docs/demo-runbook.md` for the offline-capable setup (`/learn`
needs only a local engine; worksheet generation needs Gemini, Supabase and
Inngest).

`E2E_STUB_GENERATION=true` exists for Playwright only. It returns one fixed
stub question, and `instrumentation.ts` announces it at server start so a
stubbed run can never be mistaken for a real one.

*How to test:* `E2E_STUB_GENERATION=true npm run dev` prints the demo-mode
warning; without it, startup is silent.

## Fresh problems instead of the fixed stub

Run the real symbolic engine from the `jotelab-ai` repo, then swap the env:

```bash
# terminal 1, in jotelab-ai:
ENGINE_API_KEY=dev-secret uvicorn service.app:app --port 8000
```

In `.env.local`: comment out `E2E_STUB_GENERATION=true`, uncomment
`ENGINE_BASE_URL` / `ENGINE_API_KEY`, restart `npm run dev` — `/learn` now
generates a new engine-verified problem every visit and re-roll.

## How to test

```bash
# unit tests for the coach logic:
npx vitest run features/coach

# full coached solve in a real browser against this clone:
E2E_STUB_GENERATION=true npm run test:e2e:public

# quick smoke without a browser:
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/learn   # 200
```

# PhysicsJotelab

PhysicsJotelab is a physics worksheet generation platform for high-school practice. Teachers can generate customized calculation worksheets with AI-powered question generation, preview them on an A4 canvas, create anti-cheating exam variants, and export worksheets as PDFs.

## Features

- **Google OAuth login** — secure sign-in via Supabase Auth
- **Credit system** — new users receive 50 free credits
- **AI-powered question generation** — multi-provider support (Google Gemini, OpenAI)
- **Lesson-scoped presets** — pick from physics lesson presets with variable pickers
- **Math complexity & conceptual difficulty** — toggles for worksheet difficulty tuning
- **Anti-cheating exam variants** — generate shuffled worksheet variants for distribution
- **A4 worksheet preview** — live preview with LaTeX-rendered equations (KaTeX)
- **Worksheet / Answer toggle** — switch between student and answer views
- **Regenerate individual questions** — re-roll any single question without regenerating the whole sheet
- **Export PDF** — native browser print to PDF
- **Library** — browse and manage previously generated worksheets
- **Account page** — view profile and credit balance
- **Internationalization** — English and Thai language support (next-intl)
- **Background generation** — long-running worksheet generation via Inngest workflows
- **Neuro-symbolic generation** — engine-backed lessons get every number from the
  SymPy engine service; the LLM only phrases Thai prose (see `docs/ai-contract.md`)
- **Interactive coaching (`/learn`)** — solve an engine-generated problem in three
  checked steps with misconception-targeted Thai hints; the engine judges every
  input, no account required (see `docs/ux-ui-spec.md`)

## Getting Started

### Prerequisites

- Node.js v22+
- [pnpm](https://pnpm.io/) v11.5+

### Install & Run

```bash
pnpm install
pnpm dev
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

For engine-backed generation and the `/learn` coach, also point the app at a
running engine service (`jotelab-ai` repo; production deploy runbook in
`jotelab-ai/docs/deploy-render.md`):

```bash
# jotelab-ai: ENGINE_API_KEY=dev-secret uvicorn service.app:app --port 8000
ENGINE_BASE_URL=http://127.0.0.1:8000
ENGINE_API_KEY=dev-secret
```

*How to test:* `curl -s $ENGINE_BASE_URL/health` lists the engine topics, and
`/learn` renders a Thai SUVAT problem instead of the connection-error box.

## Testing

```bash
pnpm test              # Vitest unit + component tests
pnpm test:watch        # Vitest in watch mode
pnpm test:coverage     # Coverage with enforced thresholds
pnpm test:e2e          # Playwright E2E (starts dev server locally)
pnpm test:e2e:public   # Public auth-guard tests only
pnpm test:e2e:authenticated  # Authenticated E2E (requires local Supabase)
pnpm test:e2e:ui       # Playwright UI mode
```

Public E2E tests (auth redirects, login page) run without Supabase. Authenticated E2E uses a **local Docker Supabase** stack (`supabase start`) with stub generation — no remote secrets required.

**Local authenticated E2E** (requires Docker and the Supabase CLI):

```bash
supabase start
eval "$(bash scripts/ci-supabase-e2e-env.sh)"
E2E_STUB_GENERATION=true pnpm build
E2E_STUB_GENERATION=true pnpm test:e2e:authenticated
```

Golden-path only (preset → preview → generate):

```bash
E2E_STUB_GENERATION=true pnpm test:e2e:authenticated e2e/authenticated/generate-golden-path.spec.ts
```

**CI authenticated E2E**: add the `run-e2e` label to a pull request. GitHub Actions starts local Supabase in Docker, runs migrations, and executes the authenticated Playwright suite. No repository secrets or variables are required. Create the `run-e2e` label in GitHub (Issues → Labels) if it does not exist yet.

**Engine contract fixture**: `tests/fixtures/sympy-data-contract.json` is a copy of the canonical `sympy_data` payload pinned in `jotelab-ai/tests/fixtures/sympy_data_contract.json`; `lib/engine/topics.test.ts` parses it with the Zod mirror to catch two-repo contract drift. When the engine contract changes, regenerate both copies (command in `jotelab-ai/tests/test_contract_fixture.py`).

AI integration smoke test (not part of `pnpm test`):

```bash
pnpm test:generate-question
```

### Background Worksheet Generation (Inngest)

Multi-question generation runs as an Inngest workflow. Local development:

1. Add to `.env.local`:
   - `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` (from the Inngest dashboard or `npx inngest-cli dev`)
   - `SUPABASE_SERVICE_ROLE_KEY` (worker updates jobs and mints user-scoped RPC sessions)
   - `SUPABASE_JWT_SECRET` (project JWT secret from Supabase API settings; used only on the server)
2. Run `pnpm dev` and `pnpm dev:inngest` in separate terminals.
3. Open the Inngest dev server UI (printed by the CLI) to inspect function runs.

Production: register the app URL `https://physics-jotelab.vercel.app/api/inngest` in Inngest and set the same env vars in Vercel.

## Tech Stack

- **Framework** — Next.js App Router (v16)
- **Language** — TypeScript
- **UI** — React 19, Tailwind CSS v4, shadcn/ui, Radix UI
- **Math Rendering** — KaTeX via react-katex
- **Auth & Database** — Supabase Auth + PostgreSQL
- **AI** — Vercel AI SDK with Google Gemini & OpenAI providers
- **Background Jobs** — Inngest
- **Internationalization** — next-intl (EN / TH)
- **Package Manager** — pnpm
- **Hosting** — Vercel
- **Testing** — Vitest, Testing Library, Playwright

## Project Structure

```
app/              # Next.js App Router pages and API routes
  (auth)/         # Auth-gated layout group
  (dashboard)/    # Dashboard layout group
  api/            # API routes (Inngest, generation, etc.)
  auth/           # OAuth callback handler
components/       # Shared UI components (shadcn/ui based)
features/         # Feature modules
  auth/           # Authentication logic
  generate/       # Worksheet generation UI and actions
  i18n/           # Internationalization utilities
  library/        # Worksheet library
  worksheet/      # Worksheet preview, variants, and export
i18n/             # next-intl routing and config
lib/              # Shared utilities and Supabase client
messages/         # Locale JSON files (en.json, th.json)
scripts/          # Helper scripts (CI, test utilities)
supabase/         # Migrations and Supabase config
e2e/              # Playwright E2E test suites
tests/            # Vitest unit and component tests
```

## Docs

- `docs/product.md` — product vision, users, flow, and risks
- `docs/mvp-spec.md` — MVP requirements and acceptance criteria
- `docs/data-model.md` — database schema, RPCs, and credit rules
- `docs/ai-contract.md` — AI generation input/output contract and failure policy
- `docs/implementation-guide.md` — architecture, coding rules, and implementation order
- `docs/ux-ui-spec.md` — high-level design principles, layout strategies, and user flows

## Google OAuth Setup (Production)

OAuth redirect URLs are resolved at runtime from request headers (`x-forwarded-host`, `host`, `referer`). Configure these external services so login works on all domains.

### Supabase Dashboard → Authentication → URL Configuration

| Setting | Value |
|---------|-------|
| **Site URL** | `https://physics-jotelab.vercel.app` |
| **Redirect URLs** | `https://physics-jotelab.vercel.app/auth/callback` |
| | `http://localhost:3000/auth/callback` |

Ensure the hosted project has the `ensure_user_profile()` RPC (see `supabase/migrations/20260516000000_phase_2_auth_profiles.sql`).

### Google Cloud Console → OAuth 2.0 Client

**Authorized JavaScript origins:**

- `https://physics-jotelab.vercel.app`
- `http://localhost:3000`

**Authorized redirect URIs** (Supabase handles the Google callback):

- `https://<project-ref>.supabase.co/auth/v1/callback`

### Vercel Environment Variables

Set for Production (and Preview if needed):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL=https://physics-jotelab.vercel.app` (fallback only; do not use `localhost:3000` in Production)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY` (optional if using Vercel AI Gateway)

Redeploy after changing environment variables.

## License

Private — all rights reserved.

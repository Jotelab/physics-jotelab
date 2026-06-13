# PhysicsJotelab

PhysicsJotelab is a worksheet generation platform for high-school math, physics, and chemistry practice.

Users can generate customized calculation worksheets, preview them on an A4 canvas, view answers, regenerate individual questions, and export worksheets as PDFs.

## MVP

- Google OAuth login
- New users receive 50 credits
- Generate worksheet (Subject, Lesson, Scenario)
- A4 worksheet preview
- Worksheet / Answer toggle
- Regenerate individual question
- Export PDF (native browser print)
- Library
- Account page

## Testing

```bash
npm test              # Vitest unit + component tests
npm run test:watch    # Vitest in watch mode
npm run test:coverage # Same as CI; enforces generate coverage thresholds
npm run test:e2e      # Playwright E2E (starts dev server locally)
npm run test:e2e:public  # Public auth-guard tests only
npm run test:e2e:authenticated  # Authenticated E2E (requires local Supabase)
npm run test:e2e:ui   # Playwright UI mode
```

Public E2E tests (auth redirects, login page) run without Supabase. Authenticated E2E uses a **local Docker Supabase** stack (`supabase start`) with stub generation — no remote secrets required.

**Local authenticated E2E** (requires Docker and the Supabase CLI):

```bash
supabase start
eval "$(bash scripts/ci-supabase-e2e-env.sh)"
E2E_STUB_GENERATION=true npm run build
E2E_STUB_GENERATION=true npm run test:e2e:authenticated
```

Golden-path only (preset → preview → generate):

```bash
E2E_STUB_GENERATION=true npm run test:e2e:authenticated e2e/authenticated/generate-golden-path.spec.ts
```

**CI authenticated E2E**: add the `run-e2e` label to a pull request. GitHub Actions starts local Supabase in Docker, runs migrations, and executes the authenticated Playwright suite. No repository secrets or variables are required. Create the `run-e2e` label in GitHub (Issues → Labels) if it does not exist yet.

AI integration smoke test (not part of `npm test`):

```bash
npm run test:generate-question
```

### Background worksheet generation (Inngest)

Multi-question generation runs as an Inngest workflow. Local development:

1. Add to `.env.local`:
   - `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` (from the Inngest dashboard or `npx inngest-cli dev`)
   - `SUPABASE_SERVICE_ROLE_KEY` (worker updates jobs and mints user-scoped RPC sessions)
   - `SUPABASE_JWT_SECRET` (project JWT secret from Supabase API settings; used only on the server)
2. Run `npm run dev` and `npm run dev:inngest` in separate terminals.
3. Open the Inngest dev server UI (printed by the CLI) to inspect function runs.

Production: register the app URL `https://physics-jotelab.vercel.app/api/inngest` in Inngest and set the same env vars in Vercel.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase Auth + PostgreSQL
- Vercel AI SDK
- Inngest (background worksheet generation)
- Vercel

## Docs

- `docs/product.md` — product vision, users, flow, and risks
- `docs/mvp-spec.md` — MVP requirements and acceptance criteria
- `docs/data-model.md` — database schema, RPCs, and credit rules
- `docs/ai-contract.md` — AI generation input/output contract and failure policy
- `docs/implementation-guide.md` — architecture, coding rules, and implementation order
- `docs/ux-ui-spec.md` — high-level design principles, layout strategies, and user flows

## Google OAuth setup (production)

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

### Vercel environment variables

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

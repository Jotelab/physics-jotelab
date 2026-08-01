<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Package manager

pnpm only (`packageManager` in `package.json`). `package-lock.json`, `bun.lock`,
and `yarn.lock` are gitignored — a stray `npm install` or `bun install` produces
a second dependency graph and duplicate copies of packages, which breaks
`tsc --noEmit` with "not assignable to type" errors between identical types.

If typecheck reports two versions of the same package, the fix is
`rm -rf node_modules && pnpm install --frozen-lockfile`, not a type cast.

# Before you push

```bash
pnpm run check
```

Runs `typecheck` → `lint` → `db:functions:check` → `test`. CI runs the same
steps. Note that `pnpm run test` alone does **not** typecheck — vitest strips
types, so a spec can pass while being type-broken.

# Adding a subject or an engine topic

A subject's entire catalog lives in one content pack
(`features/generate/data/content-packs/<subject>.ts`): lesson ids and labels,
scenarios, variable presets, given/find compatibility, prompt fragments, **and**
which lessons are engine-backed (`engineTopics`).

Adding a subject = author a pack and register it in `subject-content-packs.ts`.
Nothing in `lib/` should need editing — `lib/engine/topics.ts` is pure routing
over the packs and holds no subject data.

The one exception is diagrams. `lib/tikz/templates/` is keyed by *engine topic*,
not subject, because diagrams are attached at read time from a stored question
and that row carries only `sympy_data` (no subject/lesson). Declaring a new
engine topic therefore fails `lib/tikz/templates/index.test.ts` until you either
register a TikZ builder or add the topic to `TOPICS_WITHOUT_DIAGRAMS` — an
explicit decision, not a silent omission.

Keep engine variable metadata and `variablePresets` in agreement on symbol and
unit; `lib/engine/topics.test.ts` cross-checks them.

# Changing a Postgres function

Migrations are append-only and `create or replace function` has no patch form,
so changing one line means re-pasting the whole function into a new migration.
To keep that reviewable, `supabase/sql/functions/` holds the canonical current
definition of every function, generated from the migration history.

1. `pnpm run db:functions:emit <function_name>` — print the current definition
2. Paste into a new migration and edit it there
3. `pnpm run db:functions:sync` — reconcile the canonical files
4. Commit the migration **and** the updated canonical file

`pnpm run db:functions:check` (in `check` and CI) fails if the two drift. See
`supabase/sql/functions/README.md` for the full rationale.

Never edit an existing migration — it is applied history.

Two traps the check exists to catch:

- Adding a parameter with `create or replace` **creates a new overload** and
  leaves the old arity live. Drop the old signature explicitly.
- When a function is called from several other functions, updating one caller
  does not update the rest. Grep the canonical directory for call sites.

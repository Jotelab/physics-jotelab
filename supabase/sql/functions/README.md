# Canonical Postgres function sources

Every `.sql` file here is the **current definition of one database function**,
reconstructed from the migration history. A `__6` / `__7` suffix disambiguates
live overloads by argument count.

These files are generated. Do not edit them by hand.

> Note: this lives at `supabase/sql/functions/`, not `supabase/functions/`.
> The CLI reserves the latter for Edge Functions (`supabase functions
> deploy|serve`, plus the local edge-runtime container that `config.toml`
> enables), so putting `.sql` files there would collide with that tooling.

## Why this directory exists

Migrations are append-only, and `create or replace function` has no patch form —
so changing one line of a 276-line PL/pgSQL function means pasting the whole
function into a new migration. Before this directory existed:

- `complete_generate_question_reservation` had been fully re-pasted 6 times
- `is_valid_worksheet_question` 6 times, `is_valid_generation_settings` 7 times
- `20260705000000_worksheet_question_sympy_data.sql` was 988 lines, almost all
  of it verbatim re-paste

Two things follow. Reviewing a migration meant eyeballing a 300-line diff for
the two lines that actually changed. And a fix applied to one copy did not
reach the others — which is how `_worksheet_question_row_to_jsonb` ended up
with **two live overloads** (a `p_sympy_data` parameter was added with `create
or replace`, silently leaving the 6-argument version behind), the same way
`update_generation_job_progress` did before migration `20260625000000` cleaned
it up.

The migrations stay as they are — they are applied history and must not be
edited. This directory adds the missing piece: a single, diffable place where
each function's *current* definition lives.

## Why generation instead of `\i` includes

The obvious fix is to have migrations `\i` a shared file. That does not work
here: `supabase db push` and `supabase start` execute each migration over a
Postgres driver, not through `psql`. Backslash meta-commands are a `psql`
client feature and are a syntax error on the server.

So migrations must remain self-contained plain SQL. Instead of including the
canonical file at apply time, we **emit** it into the migration at authoring
time and then **verify** the two never diverge.

## Workflow

Changing a function:

```bash
pnpm run db:functions:emit complete_generate_question_reservation
```

Paste that into a new migration, edit it there, apply it, then reconcile:

```bash
pnpm run db:functions:sync
```

Commit the migration **and** the updated canonical file. The migration diff
still shows the full body (unavoidable), but the canonical file's diff shows
only what you actually changed — that is the diff to review.

Verifying:

```bash
pnpm run db:functions:check
```

Replays every migration in order, computes each function's effective
definition, and fails if it disagrees with the canonical file. This runs in
`pnpm run check` and in CI, so the canonical set cannot silently go stale.

It also warns when one function name has multiple live overloads, which is
almost always a forgotten `drop function` after adding a parameter.

## Ground truth

`db:functions:check` compares against migrations using our own SQL scanner, so
on its own it only proves the scanner is self-consistent. The stronger check
applies all migrations to a real Postgres and asks the server what exists:

```bash
pnpm run db:functions:verify
```

It needs Docker, takes about a minute, and runs a throwaway
`postgres:17-alpine` container with **no host port bound** — it will not
collide with a `supabase start` you already have running. It is deliberately
**not** part of `pnpm run check`.

Run it after touching `scripts/lib/parse-sql-functions.mjs`, or any time you
want to trust this directory absolutely.

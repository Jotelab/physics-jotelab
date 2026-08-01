-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260610000000_worksheet_question_limit_constants.sql

create or replace function public.max_initial_worksheet_question_count()
returns integer
language sql
immutable
parallel safe
set search_path = public
as $$
  select 20;
$$;

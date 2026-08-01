-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260607000000_payload_size_limits.sql

create or replace function public._jsonb_string_len_ok(p_value jsonb, p_max integer)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(p_value) = 'string'
    and length(p_value #>> '{}') between 1 and p_max;
$$;

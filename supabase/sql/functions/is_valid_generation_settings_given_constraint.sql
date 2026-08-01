-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260717000000_allow_unpinned_given_constraints.sql

create or replace function public.is_valid_generation_settings_given_constraint(
  p_variable jsonb
) returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_variable ? 'value'
      then public.is_valid_generation_settings_variable(p_variable)
    else public.is_valid_generation_settings_target_variable(p_variable)
  end;
$$;

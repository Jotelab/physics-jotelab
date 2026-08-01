-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260611000000_generation_error_codes.sql

create or replace function public._generation_error_response(
  p_code text,
  p_message text,
  p_credit_balance integer default null
) returns jsonb
language sql
immutable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'success', false,
    'code', p_code,
    'message', p_message,
    'creditBalance', p_credit_balance
  ));
$$;

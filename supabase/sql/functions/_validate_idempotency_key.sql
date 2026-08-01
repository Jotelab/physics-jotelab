-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260615000000_worksheet_variants.sql
-- Redefined 2x across: 20260606000000_generation_idempotency.sql, 20260615000000_worksheet_variants.sql

create or replace function public._validate_idempotency_key(p_idempotency_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'Idempotency key required';
  end if;

  if length(p_idempotency_key) > 200 then
    raise exception 'Idempotency key too long';
  end if;

  if p_idempotency_key !~ '^(gen|regen|variant):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:.+$' then
    raise exception 'Invalid idempotency key';
  end if;
end;
$$;

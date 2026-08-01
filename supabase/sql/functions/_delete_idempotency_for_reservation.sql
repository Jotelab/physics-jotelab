-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260606000000_generation_idempotency.sql

create or replace function public._delete_idempotency_for_reservation(
  p_reservation_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.generation_idempotency
  where reservation_id = p_reservation_id;
end;
$$;

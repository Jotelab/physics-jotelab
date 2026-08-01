-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260601000000_credit_reservations.sql

create or replace function public.cleanup_expired_credit_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.credit_reservations;
  v_cleaned integer := 0;
begin
  for v_reservation in
    select *
    from public.credit_reservations
    where expires_at < now()
    for update
  loop
    perform public._refund_credit_reservation_row(v_reservation);
    v_cleaned := v_cleaned + 1;
  end loop;

  return v_cleaned;
end;
$$;

-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260627000001_gate_reservation_cleanup_probe.sql
-- Redefined 3x across: 20260601000000_credit_reservations.sql, 20260606000000_generation_idempotency.sql, 20260627000001_gate_reservation_cleanup_probe.sql

create or replace function public._cleanup_expired_reservations_for_user(
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.credit_reservations;
begin
  delete from public.generation_idempotency
  where user_id = p_user_id
    and expires_at < now();

  if exists (
    select 1
    from public.credit_reservations
    where user_id = p_user_id
      and expires_at < now()
  ) then
    for v_reservation in
      select *
      from public.credit_reservations
      where user_id = p_user_id
        and expires_at < now()
      for update
    loop
      perform public._refund_credit_reservation_row(v_reservation);
    end loop;
  end if;

  delete from public.generation_idempotency
  where user_id = p_user_id
    and status = 'reserved'
    and reservation_id is not null
    and not exists (
      select 1
      from public.credit_reservations cr
      where cr.id = generation_idempotency.reservation_id
    );
end;
$$;

-- Per-user credit serialization: gate the reservation-refund loop behind a probe.
--
-- `_cleanup_expired_reservations_for_user` runs inside every `reserve_*_credit`
-- call while the caller holds the user's `profiles` row lock. Previously it
-- always entered a `FOR ... FOR UPDATE` scan of the user's reservations even when
-- none were expired, so concurrent generate/regenerate/variant ops for one user
-- serialized on that lock longer than necessary.
--
-- Gate the row-locking loop behind a cheap `exists` probe: the common path
-- (nothing expired) skips the scan entirely. The idempotency-cleanup deletes stay
-- unconditional so orphaned `reserved` rows (which can be created by the global
-- cleanup cron or FK cascades, not only by the loop here) are still reaped.

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

revoke all on function public._cleanup_expired_reservations_for_user(uuid) from public;
revoke all on function public._cleanup_expired_reservations_for_user(uuid) from anon;
revoke all on function public._cleanup_expired_reservations_for_user(uuid) from authenticated;

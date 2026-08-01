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

create or replace function public.cancel_variant_roll_reservation(
  p_reservation_id uuid,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.credit_reservations;
  v_profile_id uuid;
  v_credit_balance integer;
begin
  perform public._validate_idempotency_key(p_idempotency_key);

  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    return public._generation_error_response('PROFILE_NOT_FOUND', 'Profile not found.');
  end if;

  select *
  into v_reservation
  from public.credit_reservations
  where id = p_reservation_id
    and user_id = v_profile_id
    and kind = 'variant_roll'
  for update;

  if not found then
    select credit_balance
    into v_credit_balance
    from public.profiles
    where id = v_profile_id;

    return jsonb_build_object('success', true, 'creditBalance', v_credit_balance);
  end if;

  v_credit_balance := public._refund_credit_reservation_row(v_reservation);

  delete from public.generation_idempotency
  where user_id = v_profile_id
    and idempotency_key = p_idempotency_key;

  return jsonb_build_object('success', true, 'creditBalance', v_credit_balance);
end;
$$;

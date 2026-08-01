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

create or replace function public.reserve_variant_roll_credit(
  p_worksheet_id uuid,
  p_variant_label text,
  p_order integer,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current_balance integer;
  v_new_balance integer;
  v_question_count integer;
  v_saved_count integer;
  v_reservation_id uuid;
  v_credit_transaction_id uuid;
  v_idempotency public.generation_idempotency;
begin
  perform public._validate_idempotency_key(p_idempotency_key);

  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_variant_label is null or p_variant_label not in ('B', 'C', 'D') then
    raise exception 'Invalid variant label';
  end if;

  if p_order is null
    or p_order < 1
    or p_order > public.max_worksheet_question_count()
  then
    raise exception 'Invalid question order';
  end if;

  select id, credit_balance
  into v_profile_id, v_current_balance
  from public.profiles
  where auth_user_id = auth.uid()
  for update;

  if v_profile_id is null then
    return public._generation_error_response('PROFILE_NOT_FOUND', 'Profile not found.', v_current_balance);
  end if;

  perform public._cleanup_expired_reservations_for_user(v_profile_id);

  select *
  into v_idempotency
  from public.generation_idempotency
  where user_id = v_profile_id
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_idempotency.status = 'completed' then
      return v_idempotency.completed_result || jsonb_build_object('alreadyCompleted', true);
    end if;

    if v_idempotency.status = 'reserved' then
      if exists (
        select 1
        from public.credit_reservations cr
        where cr.id = v_idempotency.reservation_id
      ) then
        select credit_balance
        into v_current_balance
        from public.profiles
        where id = v_profile_id;

        return jsonb_build_object(
          'reservationId', v_idempotency.reservation_id,
          'creditBalance', v_current_balance,
          'alreadyCompleted', false
        );
      end if;

      delete from public.generation_idempotency
      where user_id = v_profile_id
        and idempotency_key = p_idempotency_key;
    elsif v_idempotency.status = 'failed' then
      delete from public.generation_idempotency
      where user_id = v_profile_id
        and idempotency_key = p_idempotency_key;
    end if;
  end if;

  if v_current_balance < 1 then
    return public._generation_error_response('INSUFFICIENT_CREDITS', 'You do not have enough credits.', v_current_balance);
  end if;

  select w.question_count
  into v_question_count
  from public.worksheets w
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
  for update;

  if v_question_count is null then
    return public._generation_error_response('WORKSHEET_ACCESS_DENIED', 'You do not have access to this worksheet.', v_current_balance);
  end if;

  if p_order > v_question_count then
    return public._generation_error_response('WORKSHEET_ALREADY_COMPLETE', 'Invalid question order.', v_current_balance);
  end if;

  select count(*)
  into v_saved_count
  from public.worksheet_questions wq
  where wq.worksheet_id = p_worksheet_id;

  if v_saved_count < v_question_count then
    return public._generation_error_response('VALIDATION_FAILED', 'Worksheet must be fully generated before creating variants.', v_current_balance);
  end if;

  if not exists (
    select 1
    from public.worksheet_questions wq
    where wq.worksheet_id = p_worksheet_id
      and wq.question_order = p_order
  ) then
    return public._generation_error_response('QUESTION_NOT_FOUND', 'Master question not found.', v_current_balance);
  end if;

  v_new_balance := v_current_balance - 1;

  update public.profiles
  set credit_balance = v_new_balance,
      updated_at = now()
  where id = v_profile_id;

  insert into public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    worksheet_id
  )
  values (
    v_profile_id,
    'variant_roll',
    -1,
    v_new_balance,
    p_worksheet_id
  )
  returning id into v_credit_transaction_id;

  insert into public.credit_reservations (
    user_id,
    worksheet_id,
    kind,
    question_order,
    variant_label,
    credit_transaction_id
  )
  values (
    v_profile_id,
    p_worksheet_id,
    'variant_roll',
    p_order,
    p_variant_label,
    v_credit_transaction_id
  )
  returning id into v_reservation_id;

  insert into public.generation_idempotency (
    user_id,
    idempotency_key,
    kind,
    worksheet_id,
    status,
    reservation_id,
    expires_at
  )
  values (
    v_profile_id,
    p_idempotency_key,
    'variant_roll',
    p_worksheet_id,
    'reserved',
    v_reservation_id,
    now() + interval '24 hours'
  );

  return jsonb_build_object(
    'reservationId', v_reservation_id,
    'creditBalance', v_new_balance,
    'alreadyCompleted', false
  );
end;
$$;

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
-- Redefined 4x across: 20260606000000_generation_idempotency.sql, 20260609000000_worksheet_questions.sql, 20260610000000_worksheet_question_limit_constants.sql, 20260611000000_generation_error_codes.sql

create or replace function public.reserve_generate_question_credit(
  p_worksheet_id uuid,
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
  v_reservation_id uuid;
  v_credit_transaction_id uuid;
  v_pending_question_id uuid;
  v_idempotency public.generation_idempotency;
  v_reconciled jsonb;
begin
  perform public._validate_idempotency_key(p_idempotency_key);

  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_order is null
    or p_order < 1
    or p_order > public.max_worksheet_question_count() then
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
          'pendingQuestionId', v_idempotency.pending_question_id,
          'alreadyCompleted', false
        );
      end if;

      v_reconciled := public._try_reconcile_completed_generate_idempotency(
        v_idempotency,
        v_profile_id,
        p_worksheet_id,
        p_order
      );

      if v_reconciled is not null then
        return v_reconciled;
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
    return public._generation_error_response('WORKSHEET_ALREADY_COMPLETE', 'This worksheet is already complete.', v_current_balance);
  end if;

  if exists (
    select 1
    from public.worksheet_questions wq
    where wq.worksheet_id = p_worksheet_id
      and wq.question_order = p_order
  ) then
    return public._generation_error_response('SLOT_ALREADY_RESERVED', 'This question slot is already being generated or is complete.', v_current_balance);
  end if;

  if exists (
    select 1
    from public.credit_reservations cr
    where cr.worksheet_id = p_worksheet_id
      and cr.kind = 'generate_question'
      and cr.question_order = p_order
  ) then
    return public._generation_error_response('SLOT_ALREADY_RESERVED', 'This question slot is already being generated or is complete.', v_current_balance);
  end if;

  v_new_balance := v_current_balance - 1;
  v_pending_question_id := gen_random_uuid();

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
    'generate_worksheet',
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
    credit_transaction_id
  )
  values (
    v_profile_id,
    p_worksheet_id,
    'generate_question',
    p_order,
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
    pending_question_id,
    expires_at
  )
  values (
    v_profile_id,
    p_idempotency_key,
    'generate_question',
    p_worksheet_id,
    'reserved',
    v_reservation_id,
    v_pending_question_id,
    now() + interval '24 hours'
  );

  return jsonb_build_object(
    'reservationId', v_reservation_id,
    'creditBalance', v_new_balance,
    'pendingQuestionId', v_pending_question_id,
    'alreadyCompleted', false
  );
end;
$$;

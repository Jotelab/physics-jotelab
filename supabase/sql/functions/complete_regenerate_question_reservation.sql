-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260705000000_worksheet_question_sympy_data.sql
-- Redefined 4x across: 20260606000000_generation_idempotency.sql, 20260609000000_worksheet_questions.sql, 20260611000000_generation_error_codes.sql, 20260705000000_worksheet_question_sympy_data.sql

create or replace function public.complete_regenerate_question_reservation(
  p_reservation_id uuid,
  p_new_question jsonb,
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
  v_locked_worksheet_id uuid;
  v_existing_order integer;
  v_updated_question jsonb;
  v_rows_updated integer;
  v_idempotency public.generation_idempotency;
  v_result jsonb;
begin
  perform public._validate_idempotency_key(p_idempotency_key);

  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_valid_worksheet_question(p_new_question) then
    raise exception 'Invalid worksheet question';
  end if;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    raise exception 'Profile not found';
  end if;

  select *
  into v_idempotency
  from public.generation_idempotency
  where user_id = v_profile_id
    and idempotency_key = p_idempotency_key
  for update;

  if found and v_idempotency.status = 'completed' then
    return v_idempotency.completed_result;
  end if;

  select *
  into v_reservation
  from public.credit_reservations
  where id = p_reservation_id
    and user_id = v_profile_id
  for update;

  if not found then
    raise exception 'Reservation not found';
  end if;

  if v_reservation.expires_at < now() then
    raise exception 'Reservation expired';
  end if;

  if v_reservation.kind <> 'regenerate_question' then
    raise exception 'Reservation not found';
  end if;

  if p_new_question->>'id' <> v_reservation.question_id then
    raise exception 'Question id cannot be changed';
  end if;

  select w.id
  into v_locked_worksheet_id
  from public.worksheets w
  where w.id = v_reservation.worksheet_id
    and w.user_id = v_profile_id
  for update;

  if v_locked_worksheet_id is null then
    v_credit_balance := public._refund_credit_reservation_row(v_reservation);

    delete from public.generation_idempotency
    where user_id = v_profile_id
      and idempotency_key = p_idempotency_key;

    return jsonb_build_object(
      'success', false,
      'code', 'QUESTION_NOT_FOUND',
      'creditBalance', v_credit_balance,
      'message', 'Question not found.'
    );
  end if;

  select wq.question_order
  into v_existing_order
  from public.worksheets w
  join public.worksheet_questions wq on wq.worksheet_id = w.id
  where w.id = v_reservation.worksheet_id
    and w.user_id = v_profile_id
    and wq.id = v_reservation.question_id::uuid;

  if v_existing_order is null then
    v_credit_balance := public._refund_credit_reservation_row(v_reservation);

    delete from public.generation_idempotency
    where user_id = v_profile_id
      and idempotency_key = p_idempotency_key;

    return jsonb_build_object(
      'success', false,
      'code', 'QUESTION_NOT_FOUND',
      'creditBalance', v_credit_balance,
      'message', 'Question not found.'
    );
  end if;

  if (p_new_question->>'order')::integer <> v_existing_order then
    raise exception 'Question order cannot be changed';
  end if;

  update public.worksheet_questions wq
  set question_text = p_new_question->>'question_text',
      given_values = p_new_question->'given_values',
      target_variable = p_new_question->'target_variable',
      solution = p_new_question->'solution',
      sympy_data = p_new_question->'sympy_data'
  from public.worksheets w
  where wq.worksheet_id = w.id
    and w.id = v_reservation.worksheet_id
    and w.user_id = v_profile_id
    and wq.id = v_reservation.question_id::uuid
    and (p_new_question->>'order')::integer <= w.question_count
  returning public._worksheet_question_row_to_jsonb(
    wq.id,
    wq.question_order,
    wq.question_text,
    wq.given_values,
    wq.target_variable,
    wq.solution,
    wq.sympy_data
  ) into v_updated_question;

  get diagnostics v_rows_updated = row_count;

  if v_rows_updated = 0 or v_updated_question is null then
    v_credit_balance := public._refund_credit_reservation_row(v_reservation);

    delete from public.generation_idempotency
    where user_id = v_profile_id
      and idempotency_key = p_idempotency_key;

    return jsonb_build_object(
      'success', false,
      'code', 'QUESTION_NOT_FOUND',
      'creditBalance', v_credit_balance,
      'message', 'Question not found.'
    );
  end if;

  update public.worksheets
  set updated_at = now()
  where id = v_reservation.worksheet_id;

  delete from public.credit_reservations
  where id = v_reservation.id;

  select credit_balance
  into v_credit_balance
  from public.profiles
  where id = v_profile_id;

  v_result := jsonb_build_object(
    'success', true,
    'question', v_updated_question,
    'creditBalance', v_credit_balance
  );

  insert into public.generation_idempotency (
    user_id,
    idempotency_key,
    kind,
    worksheet_id,
    status,
    completed_result,
    expires_at
  )
  values (
    v_profile_id,
    p_idempotency_key,
    'regenerate_question',
    v_reservation.worksheet_id,
    'completed',
    v_result,
    now() + interval '24 hours'
  )
  on conflict (user_id, idempotency_key) do update
    set status = 'completed',
        completed_result = excluded.completed_result,
        reservation_id = null,
        updated_at = now();

  return v_result;
end;
$$;

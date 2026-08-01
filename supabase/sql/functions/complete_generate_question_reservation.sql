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

create or replace function public.complete_generate_question_reservation(
  p_reservation_id uuid,
  p_question jsonb,
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
  v_updated_question jsonb;
  v_existing_question jsonb;
  v_inserted_id uuid;
  v_idempotency public.generation_idempotency;
  v_result jsonb;
begin
  perform public._validate_idempotency_key(p_idempotency_key);

  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_valid_worksheet_question(p_question) then
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

  if found
    and v_idempotency.pending_question_id is not null
    and p_question->>'id' <> v_idempotency.pending_question_id::text then
    raise exception 'Question id does not match reservation';
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

  if v_reservation.kind <> 'generate_question' then
    raise exception 'Reservation not found';
  end if;

  if (p_question->>'order')::integer <> v_reservation.question_order then
    raise exception 'Question order does not match reservation';
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
      'code', 'WORKSHEET_ACCESS_DENIED',
      'creditBalance', v_credit_balance,
      'message', 'You do not have access to this worksheet.'
    );
  end if;

  select public._worksheet_question_row_to_jsonb(
    wq.id,
    wq.question_order,
    wq.question_text,
    wq.given_values,
    wq.target_variable,
    wq.solution,
    wq.sympy_data
  )
  into v_existing_question
  from public.worksheets w
  join public.worksheet_questions wq on wq.worksheet_id = w.id
  where w.id = v_reservation.worksheet_id
    and w.user_id = v_profile_id
    and (
      wq.id = (p_question->>'id')::uuid
      or wq.question_order = v_reservation.question_order
    )
  limit 1;

  if v_existing_question is not null then
    delete from public.credit_reservations
    where id = v_reservation.id;

    select credit_balance
    into v_credit_balance
    from public.profiles
    where id = v_profile_id;

    v_result := jsonb_build_object(
      'success', true,
      'question', v_existing_question,
      'creditBalance', v_credit_balance
    );

    insert into public.generation_idempotency (
      user_id,
      idempotency_key,
      kind,
      worksheet_id,
      status,
      completed_result,
      pending_question_id,
      expires_at
    )
    values (
      v_profile_id,
      p_idempotency_key,
      'generate_question',
      v_reservation.worksheet_id,
      'completed',
      v_result,
      (p_question->>'id')::uuid,
      now() + interval '24 hours'
    )
    on conflict (user_id, idempotency_key) do update
      set status = 'completed',
          completed_result = excluded.completed_result,
          reservation_id = null,
          updated_at = now();

    return v_result;
  end if;

  insert into public.worksheet_questions (
    id,
    worksheet_id,
    question_order,
    question_text,
    given_values,
    target_variable,
    solution,
    sympy_data
  )
  select
    (p_question->>'id')::uuid,
    w.id,
    (p_question->>'order')::integer,
    p_question->>'question_text',
    p_question->'given_values',
    p_question->'target_variable',
    p_question->'solution',
    p_question->'sympy_data'
  from public.worksheets w
  where w.id = v_reservation.worksheet_id
    and w.user_id = v_profile_id
    and (select count(*) from public.worksheet_questions wq where wq.worksheet_id = w.id) < w.question_count
    and (p_question->>'order')::integer <= w.question_count
  on conflict do nothing
  returning id into v_inserted_id;

  if v_inserted_id is not null then
    select public._worksheet_question_row_to_jsonb(
      wq.id,
      wq.question_order,
      wq.question_text,
      wq.given_values,
      wq.target_variable,
      wq.solution,
      wq.sympy_data
    )
    into v_updated_question
    from public.worksheet_questions wq
    where wq.id = v_inserted_id;
  else
    v_updated_question := null;
  end if;

  if v_updated_question is null then
    v_credit_balance := public._refund_credit_reservation_row(v_reservation);

    delete from public.generation_idempotency
    where user_id = v_profile_id
      and idempotency_key = p_idempotency_key;

    return jsonb_build_object(
      'success', false,
      'code', 'WORKSHEET_ACCESS_DENIED',
      'creditBalance', v_credit_balance,
      'message', 'You do not have access to this worksheet.'
    );
  end if;

  update public.credit_transactions
  set question_id = p_question->>'id'
  where id = v_reservation.credit_transaction_id;

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
    pending_question_id,
    expires_at
  )
  values (
    v_profile_id,
    p_idempotency_key,
    'generate_question',
    v_reservation.worksheet_id,
    'completed',
    v_result,
    (p_question->>'id')::uuid,
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

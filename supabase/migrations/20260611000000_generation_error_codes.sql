create or replace function public._generation_error_response(
  p_code text,
  p_message text,
  p_credit_balance integer default null
) returns jsonb
language sql
immutable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'success', false,
    'code', p_code,
    'message', p_message,
    'creditBalance', p_credit_balance
  ));
$$;




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



create or replace function public.reserve_regenerate_question_credit(
  p_worksheet_id uuid,
  p_question_id text,
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
  v_existing_order integer;
  v_locked_worksheet_id uuid;
  v_reservation_id uuid;
  v_credit_transaction_id uuid;
  v_idempotency public.generation_idempotency;
  v_reconciled jsonb;
begin
  perform public._validate_idempotency_key(p_idempotency_key);

  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_question_id is null or length(trim(p_question_id)) = 0 then
    raise exception 'Invalid question id';
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

      v_reconciled := public._try_reconcile_completed_regenerate_idempotency(
        v_idempotency,
        v_profile_id,
        p_worksheet_id,
        p_question_id
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

  select w.id
  into v_locked_worksheet_id
  from public.worksheets w
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
  for update;

  if v_locked_worksheet_id is null then
    return public._generation_error_response('WORKSHEET_ACCESS_DENIED', 'You do not have access to this worksheet.', v_current_balance);
  end if;

  select wq.question_order
  into v_existing_order
  from public.worksheets w
  join public.worksheet_questions wq on wq.worksheet_id = w.id
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
    and wq.id = p_question_id::uuid;

  if v_existing_order is null then
    return public._generation_error_response('QUESTION_NOT_FOUND', 'Question not found.', v_current_balance);
  end if;

  if exists (
    select 1
    from public.credit_reservations cr
    where cr.worksheet_id = p_worksheet_id
      and cr.kind = 'regenerate_question'
      and cr.question_id = p_question_id
  ) then
    return public._generation_error_response('SLOT_ALREADY_RESERVED', 'This question slot is already being generated or is complete.', v_current_balance);
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
    worksheet_id,
    question_id
  )
  values (
    v_profile_id,
    'regenerate_question',
    -1,
    v_new_balance,
    p_worksheet_id,
    p_question_id
  )
  returning id into v_credit_transaction_id;

  insert into public.credit_reservations (
    user_id,
    worksheet_id,
    kind,
    question_id,
    credit_transaction_id
  )
  values (
    v_profile_id,
    p_worksheet_id,
    'regenerate_question',
    p_question_id,
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
    'regenerate_question',
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
    wq.solution
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
    solution
  )
  select
    (p_question->>'id')::uuid,
    w.id,
    (p_question->>'order')::integer,
    p_question->>'question_text',
    p_question->'given_values',
    p_question->'target_variable',
    p_question->'solution'
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
      wq.solution
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
      solution = p_new_question->'solution'
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
    wq.solution
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


drop function if exists public.generate_worksheet_init(text, text, integer, jsonb);
drop function if exists public.extend_worksheet_count(uuid, integer);
drop function if exists public.enqueue_generation_job(uuid, integer, integer, text);


create or replace function public.generate_worksheet_init(
  p_title text,
  p_subject text,
  p_question_count integer,
  p_generation_settings jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current_balance integer;
  v_worksheet_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_subject is null or p_subject not in ('math', 'physics', 'chemistry') then
    raise exception 'Invalid subject';
  end if;

  if p_question_count is null
    or p_question_count < 1
    or p_question_count > public.max_initial_worksheet_question_count() then
    raise exception 'Invalid question count';
  end if;

  if not public.is_valid_generation_settings(p_generation_settings) then
    raise exception 'Invalid generation settings';
  end if;

  select id, credit_balance
  into v_profile_id, v_current_balance
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    return public._generation_error_response('PROFILE_NOT_FOUND', 'Profile not found.');
  end if;

  if v_current_balance < 1 then
    return public._generation_error_response('INSUFFICIENT_CREDITS', 'You do not have enough credits.');
  end if;

  insert into public.worksheets (
    user_id,
    title,
    subject,
    question_count,
    generation_settings
  )
  values (
    v_profile_id,
    p_title,
    p_subject,
    p_question_count,
    p_generation_settings
  )
  returning id into v_worksheet_id;

  return jsonb_build_object('success', true, 'worksheetId', v_worksheet_id);
end;
$$;



create or replace function public.extend_worksheet_count(
  p_worksheet_id uuid,
  p_additional_count integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current_count integer;
  v_new_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_additional_count is null
    or p_additional_count < 1
    or p_additional_count > public.max_extend_questions_per_request() then
    raise exception 'Invalid additional count';
  end if;

  select p.id
  into v_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid();

  if v_profile_id is null then
    return public._generation_error_response('PROFILE_NOT_FOUND', 'Profile not found.');
  end if;

  select w.question_count
  into v_current_count
  from public.worksheets w
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
  for update;

  if v_current_count is null then
    return public._generation_error_response('WORKSHEET_ACCESS_DENIED', 'You do not have access to this worksheet.');
  end if;

  if v_current_count + p_additional_count > public.max_worksheet_question_count() then
    return public._generation_error_response('VALIDATION_FAILED', 'Worksheet question limit exceeded.');
  end if;

  v_new_count := v_current_count + p_additional_count;

  update public.worksheets
  set question_count = v_new_count,
      updated_at = now()
  where id = p_worksheet_id
    and user_id = v_profile_id;

  return jsonb_build_object('success', true, 'questionCount', v_new_count);
end;
$$;



create or replace function public.enqueue_generation_job(
  p_worksheet_id uuid,
  p_from_order integer,
  p_to_order integer,
  p_kind text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_worksheet_user_id uuid;
  v_question_count integer;
  v_job_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_kind is null or p_kind not in ('initial', 'append') then
    raise exception 'Invalid generation job kind';
  end if;

  if p_from_order is null or p_to_order is null
    or p_from_order < 1
    or p_to_order > public.max_worksheet_question_count()
    or p_from_order > p_to_order
  then
    raise exception 'Invalid generation job order range';
  end if;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    return public._generation_error_response('PROFILE_NOT_FOUND', 'Profile not found.');
  end if;

  select w.user_id, w.question_count
  into v_worksheet_user_id, v_question_count
  from public.worksheets w
  where w.id = p_worksheet_id
  for update;

  if v_worksheet_user_id is null or v_worksheet_user_id is distinct from v_profile_id then
    return public._generation_error_response('WORKSHEET_ACCESS_DENIED', 'You do not have access to this worksheet.');
  end if;

  if p_to_order > v_question_count then
    return public._generation_error_response('VALIDATION_FAILED', 'Generation job order range exceeds worksheet question count.');
  end if;

  if exists (
    select 1
    from public.generation_jobs gj
    where gj.worksheet_id = p_worksheet_id
      and gj.status in ('queued', 'running')
  ) then
    return public._generation_error_response('SLOT_ALREADY_RESERVED', 'A generation job is already active for this worksheet.');
  end if;

  insert into public.generation_jobs (
    user_id,
    worksheet_id,
    kind,
    status,
    from_order,
    to_order,
    last_completed_order
  )
  values (
    v_profile_id,
    p_worksheet_id,
    p_kind,
    'queued',
    p_from_order,
    p_to_order,
    0
  )
  returning id into v_job_id;

  return jsonb_build_object('success', true, 'jobId', v_job_id);
end;
$$;



create or replace function public.replace_worksheet_question(
  p_worksheet_id uuid,
  p_question_id text,
  p_edited_question jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_existing_order integer;
  v_updated_question jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_valid_worksheet_question(p_edited_question) then
    raise exception 'Invalid worksheet question';
  end if;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    return public._generation_error_response('PROFILE_NOT_FOUND', 'Profile not found.');
  end if;

  select wq.question_order
  into v_existing_order
  from public.worksheets w
  join public.worksheet_questions wq on wq.worksheet_id = w.id
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
    and wq.id = p_question_id::uuid;

  if v_existing_order is null then
    return public._generation_error_response('QUESTION_NOT_FOUND', 'Question not found.');
  end if;

  if p_edited_question->>'id' <> p_question_id then
    raise exception 'Question id cannot be changed';
  end if;

  if (p_edited_question->>'order')::integer <> v_existing_order then
    raise exception 'Question order cannot be changed';
  end if;

  update public.worksheet_questions wq
  set question_text = p_edited_question->>'question_text',
      given_values = p_edited_question->'given_values',
      target_variable = p_edited_question->'target_variable',
      solution = p_edited_question->'solution'
  from public.worksheets w
  where wq.worksheet_id = w.id
    and w.id = p_worksheet_id
    and w.user_id = v_profile_id
    and wq.id = p_question_id::uuid
    and (p_edited_question->>'order')::integer <= w.question_count
  returning public._worksheet_question_row_to_jsonb(
    wq.id,
    wq.question_order,
    wq.question_text,
    wq.given_values,
    wq.target_variable,
    wq.solution
  ) into v_updated_question;

  if v_updated_question is null then
    return public._generation_error_response('QUESTION_NOT_FOUND', 'Question not found.');
  end if;

  update public.worksheets
  set updated_at = now()
  where id = p_worksheet_id;

  return jsonb_build_object('success', true, 'question', v_updated_question);
end;
$$;




grant execute on function public.generate_worksheet_init(text, text, integer, jsonb) to authenticated;
grant execute on function public.extend_worksheet_count(uuid, integer) to authenticated;
grant execute on function public.enqueue_generation_job(uuid, integer, integer, text) to authenticated;
grant execute on function public.replace_worksheet_question(uuid, text, jsonb) to authenticated;

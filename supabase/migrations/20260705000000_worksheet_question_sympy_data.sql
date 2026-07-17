-- Store the engine's verified `sympy_data` payload alongside each question.
--
-- The neuro-symbolic path keeps the engine's `sympy_data` verbatim so every
-- number traces to its source (DEVELOPMENT_PLAN §1.2, and the contract docstring
-- in jotelab-ai `engine/contract.py`). Questions live in the normalized
-- `worksheet_questions` table, so this migration:
--   1. adds a nullable `sympy_data jsonb` column (LLM-only lessons leave it null);
--   2. permits the key in `is_valid_worksheet_question` (the strict allowlist the
--      completion RPCs run every payload through) and in the row check;
--   3. threads it through the live write/read RPCs (complete generate/regenerate,
--      replace, and the idempotency reconcile helpers) via a 7-arg row→jsonb
--      overload.
--
-- Deep shape validation of `sympy_data` lives app-side (the Zod mirror in
-- `lib/engine/sympy-data.ts`) and, authoritatively, in the engine that produced
-- it; the DB only guards the type (object) and the existing 32 KiB size cap.

-- ---------------------------------------------------------------------------
-- 1. Column
-- ---------------------------------------------------------------------------

alter table public.worksheet_questions
  add column if not exists sympy_data jsonb;

-- ---------------------------------------------------------------------------
-- 2. Allow the optional `sympy_data` key on the question JSON
-- ---------------------------------------------------------------------------

create or replace function public.is_valid_worksheet_question(
  p_question jsonb
) returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_given_value jsonb;
  v_step jsonb;
begin
  if octet_length(p_question) > 32768 then
    return false;
  end if;

  if jsonb_typeof(p_question) is distinct from 'object' then
    return false;
  end if;

  if not (
    p_question ? 'id'
    and p_question ? 'order'
    and p_question ? 'question_text'
    and p_question ? 'given_values'
    and p_question ? 'target_variable'
    and p_question ? 'solution'
  ) then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_question) as key
    where key not in (
      'format',
      'id',
      'order',
      'question_text',
      'given_values',
      'target_variable',
      'solution',
      'sympy_data'
    )
  ) then
    return false;
  end if;

  if p_question ? 'format' then
    if jsonb_typeof(p_question->'format') is distinct from 'string'
      or (p_question->>'format') not in ('calculation')
    then
      return false;
    end if;
  end if;

  if p_question ? 'sympy_data' then
    if jsonb_typeof(p_question->'sympy_data') is distinct from 'object' then
      return false;
    end if;
  end if;

  if jsonb_typeof(p_question->'id') is distinct from 'string'
    or (p_question->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return false;
  end if;

  if jsonb_typeof(p_question->'order') is distinct from 'number'
    or (p_question->>'order') !~ '^[0-9]+$'
    or (p_question->>'order')::integer not between 1 and public.max_worksheet_question_count()
  then
    return false;
  end if;

  if jsonb_typeof(p_question->'question_text') is distinct from 'string'
    or length(p_question->>'question_text') = 0
    or length(p_question->>'question_text') > 4000
  then
    return false;
  end if;

  if jsonb_typeof(p_question->'given_values') is distinct from 'array'
    or jsonb_array_length(p_question->'given_values') = 0
    or jsonb_array_length(p_question->'given_values') > 12
  then
    return false;
  end if;

  for v_given_value in
    select value from jsonb_array_elements(p_question->'given_values')
  loop
    if jsonb_typeof(v_given_value) is distinct from 'object' then
      return false;
    end if;

    if not (
      v_given_value ? 'symbol'
      and v_given_value ? 'label'
      and v_given_value ? 'value'
    ) then
      return false;
    end if;

    if exists (
      select 1
      from jsonb_object_keys(v_given_value) as key
      where key not in ('symbol', 'label', 'value', 'unit')
    ) then
      return false;
    end if;

    if not public._jsonb_string_len_ok(v_given_value->'symbol', 32)
      or not public._jsonb_string_len_ok(v_given_value->'label', 120)
    then
      return false;
    end if;

    if jsonb_typeof(v_given_value->'value') = 'string' then
      if not public._jsonb_string_len_ok(v_given_value->'value', 64) then
        return false;
      end if;
    elsif jsonb_typeof(v_given_value->'value') is distinct from 'number' then
      return false;
    end if;

    if v_given_value ? 'unit' then
      if jsonb_typeof(v_given_value->'unit') is distinct from 'string'
        or length(v_given_value->>'unit') = 0
        or length(v_given_value->>'unit') > 32
      then
        return false;
      end if;
    end if;
  end loop;

  if jsonb_typeof(p_question->'target_variable') is distinct from 'object'
    or not (p_question->'target_variable' ? 'symbol')
    or not (p_question->'target_variable' ? 'label')
  then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_question->'target_variable') as key
    where key not in ('symbol', 'label', 'unit')
  ) then
    return false;
  end if;

  if not public._jsonb_string_len_ok(p_question->'target_variable'->'symbol', 32)
    or not public._jsonb_string_len_ok(p_question->'target_variable'->'label', 120)
  then
    return false;
  end if;

  if p_question->'target_variable' ? 'unit' then
    if jsonb_typeof(p_question->'target_variable'->'unit') is distinct from 'string'
      or length(p_question->'target_variable'->>'unit') = 0
      or length(p_question->'target_variable'->>'unit') > 32
    then
      return false;
    end if;
  end if;

  if jsonb_typeof(p_question->'solution') is distinct from 'object'
    or not (p_question->'solution' ? 'steps')
    or not (p_question->'solution' ? 'final_answer')
  then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_question->'solution') as key
    where key not in ('steps', 'final_answer')
  ) then
    return false;
  end if;

  if jsonb_typeof(p_question->'solution'->'steps') is distinct from 'array'
    or jsonb_array_length(p_question->'solution'->'steps') = 0
    or jsonb_array_length(p_question->'solution'->'steps') > 24
  then
    return false;
  end if;

  for v_step in
    select value from jsonb_array_elements(p_question->'solution'->'steps')
  loop
    if not public._jsonb_string_len_ok(v_step, 2000) then
      return false;
    end if;
  end loop;

  return jsonb_typeof(p_question->'solution'->'final_answer') = 'string'
    and length(p_question->'solution'->>'final_answer') between 1 and 500;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Row check constraint now validates the stored sympy_data too
-- ---------------------------------------------------------------------------

alter table public.worksheet_questions
  drop constraint if exists worksheet_questions_row_valid,
  add constraint worksheet_questions_row_valid check (
    public.is_valid_worksheet_question(
      jsonb_build_object(
        'id', id::text,
        'order', question_order,
        'question_text', question_text,
        'given_values', given_values,
        'target_variable', target_variable,
        'solution', solution
      )
      || case
           when sympy_data is not null then jsonb_build_object('sympy_data', sympy_data)
           else '{}'::jsonb
         end
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Row → jsonb overload that carries sympy_data (omits the key when null so
--    LLM-only rows still validate against the optional Zod field)
-- ---------------------------------------------------------------------------

create or replace function public._worksheet_question_row_to_jsonb(
  p_id uuid,
  p_question_order integer,
  p_question_text text,
  p_given_values jsonb,
  p_target_variable jsonb,
  p_solution jsonb,
  p_sympy_data jsonb
) returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_id::text,
    'order', p_question_order,
    'question_text', p_question_text,
    'given_values', p_given_values,
    'target_variable', p_target_variable,
    'solution', p_solution
  )
  || case
       when p_sympy_data is not null then jsonb_build_object('sympy_data', p_sympy_data)
       else '{}'::jsonb
     end;
$$;

revoke all on function public._worksheet_question_row_to_jsonb(uuid, integer, text, jsonb, jsonb, jsonb, jsonb) from public;

-- ---------------------------------------------------------------------------
-- 5. Idempotency reconcile helpers — return sympy_data on a replay
-- ---------------------------------------------------------------------------

create or replace function public._try_reconcile_completed_generate_idempotency(
  p_idempotency public.generation_idempotency,
  p_profile_id uuid,
  p_worksheet_id uuid,
  p_order integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_question jsonb;
  v_credit_balance integer;
  v_result jsonb;
begin
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
  where w.id = p_worksheet_id
    and w.user_id = p_profile_id
    and (
      wq.question_order = p_order
      or (
        p_idempotency.pending_question_id is not null
        and wq.id = p_idempotency.pending_question_id
      )
    )
  limit 1;

  if v_existing_question is null then
    return null;
  end if;

  select credit_balance
  into v_credit_balance
  from public.profiles
  where id = p_profile_id;

  v_result := jsonb_build_object(
    'success', true,
    'question', v_existing_question,
    'creditBalance', v_credit_balance
  );

  update public.generation_idempotency
  set status = 'completed',
      completed_result = v_result,
      reservation_id = null,
      updated_at = now()
  where user_id = p_idempotency.user_id
    and idempotency_key = p_idempotency.idempotency_key;

  return v_result || jsonb_build_object('alreadyCompleted', true);
end;
$$;

create or replace function public._try_reconcile_completed_regenerate_idempotency(
  p_idempotency public.generation_idempotency,
  p_profile_id uuid,
  p_worksheet_id uuid,
  p_question_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_question jsonb;
  v_credit_balance integer;
  v_result jsonb;
begin
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
  where w.id = p_worksheet_id
    and w.user_id = p_profile_id
    and wq.id = p_question_id::uuid
  limit 1;

  if v_existing_question is null then
    return null;
  end if;

  select credit_balance
  into v_credit_balance
  from public.profiles
  where id = p_profile_id;

  v_result := jsonb_build_object(
    'success', true,
    'question', v_existing_question,
    'creditBalance', v_credit_balance
  );

  update public.generation_idempotency
  set status = 'completed',
      completed_result = v_result,
      reservation_id = null,
      updated_at = now()
  where user_id = p_idempotency.user_id
    and idempotency_key = p_idempotency.idempotency_key;

  return v_result || jsonb_build_object('alreadyCompleted', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. complete_generate_question_reservation — persist + return sympy_data
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 7. complete_regenerate_question_reservation — re-roll writes new sympy_data
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 8. replace_worksheet_question — manual edits preserve/carry sympy_data
-- ---------------------------------------------------------------------------

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
      solution = p_edited_question->'solution',
      sympy_data = p_edited_question->'sympy_data'
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
    wq.solution,
    wq.sympy_data
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

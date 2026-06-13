-- Canonical worksheet question limits (mirror features/generate/limits.ts).
-- max_worksheet_question_count = 40, max_initial = 20, max_extend_per_request = 20.

create or replace function public.max_worksheet_question_count()
returns integer
language sql
immutable
parallel safe
set search_path = public
as $$
  select 40;
$$;

create or replace function public.max_initial_worksheet_question_count()
returns integer
language sql
immutable
parallel safe
set search_path = public
as $$
  select 20;
$$;

create or replace function public.max_extend_questions_per_request()
returns integer
language sql
immutable
parallel safe
set search_path = public
as $$
  select 20;
$$;

revoke all on function public.max_worksheet_question_count() from public;
revoke all on function public.max_worksheet_question_count() from anon;
revoke all on function public.max_initial_worksheet_question_count() from public;
revoke all on function public.max_initial_worksheet_question_count() from anon;
revoke all on function public.max_extend_questions_per_request() from public;
revoke all on function public.max_extend_questions_per_request() from anon;

-- ---------------------------------------------------------------------------
-- Table CHECK constraints
-- ---------------------------------------------------------------------------

alter table public.worksheets
  drop constraint if exists worksheets_question_count_check;

alter table public.worksheets
  add constraint worksheets_question_count_check
    check (
      question_count between 1 and public.max_worksheet_question_count()
    );

alter table public.worksheet_questions
  drop constraint if exists worksheet_questions_question_order_check;

alter table public.worksheet_questions
  add constraint worksheet_questions_question_order_check
    check (
      question_order between 1 and public.max_worksheet_question_count()
    );

alter table public.generation_jobs
  drop constraint if exists generation_jobs_from_order_check;

alter table public.generation_jobs
  drop constraint if exists generation_jobs_to_order_check;

alter table public.generation_jobs
  add constraint generation_jobs_from_order_check
    check (
      from_order >= 1
      and from_order <= public.max_worksheet_question_count()
    );

alter table public.generation_jobs
  add constraint generation_jobs_to_order_check
    check (
      to_order >= 1
      and to_order <= public.max_worksheet_question_count()
    );

-- ---------------------------------------------------------------------------
-- Validators and RPCs (order bound literals only)
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
      'id',
      'order',
      'question_text',
      'given_values',
      'target_variable',
      'solution'
    )
  ) then
    return false;
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

create or replace function public.generate_worksheet_init(
  p_title text,
  p_subject text,
  p_question_count integer,
  p_generation_settings jsonb
) returns uuid
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
    raise exception 'Profile not found';
  end if;

  if v_current_balance < 1 then
    raise exception 'Insufficient credits';
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

  return v_worksheet_id;
end;
$$;

create or replace function public.extend_worksheet_count(
  p_worksheet_id uuid,
  p_additional_count integer
) returns integer
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
    raise exception 'Profile not found';
  end if;

  select w.question_count
  into v_current_count
  from public.worksheets w
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
  for update;

  if v_current_count is null then
    raise exception 'Worksheet not found';
  end if;

  if v_current_count + p_additional_count > public.max_worksheet_question_count() then
    raise exception 'Worksheet question limit exceeded';
  end if;

  v_new_count := v_current_count + p_additional_count;

  update public.worksheets
  set question_count = v_new_count,
      updated_at = now()
  where id = p_worksheet_id
    and user_id = v_profile_id;

  return v_new_count;
end;
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
    raise exception 'Profile not found';
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
    raise exception 'Insufficient credits';
  end if;

  select w.question_count
  into v_question_count
  from public.worksheets w
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
  for update;

  if v_question_count is null then
    raise exception 'Worksheet not found';
  end if;

  if p_order > v_question_count then
    raise exception 'Worksheet or question not found or already complete';
  end if;

  if exists (
    select 1
    from public.worksheet_questions wq
    where wq.worksheet_id = p_worksheet_id
      and wq.question_order = p_order
  ) then
    raise exception 'Slot already reserved or already complete';
  end if;

  if exists (
    select 1
    from public.credit_reservations cr
    where cr.worksheet_id = p_worksheet_id
      and cr.kind = 'generate_question'
      and cr.question_order = p_order
  ) then
    raise exception 'Slot already reserved or already complete';
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

create or replace function public.enqueue_generation_job(
  p_worksheet_id uuid,
  p_from_order integer,
  p_to_order integer,
  p_kind text
) returns uuid
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
    raise exception 'Profile not found';
  end if;

  select w.user_id, w.question_count
  into v_worksheet_user_id, v_question_count
  from public.worksheets w
  where w.id = p_worksheet_id
  for update;

  if v_worksheet_user_id is null or v_worksheet_user_id is distinct from v_profile_id then
    raise exception 'Worksheet not found';
  end if;

  if p_to_order > v_question_count then
    raise exception 'Generation job order range exceeds worksheet question count';
  end if;

  if exists (
    select 1
    from public.generation_jobs gj
    where gj.worksheet_id = p_worksheet_id
      and gj.status in ('queued', 'running')
  ) then
    raise exception 'A generation job is already active for this worksheet';
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

  return v_job_id;
end;
$$;

-- Worksheet anti-cheating variants: rolls stored on master worksheet + variant generation jobs.

alter table public.worksheets
  add column if not exists variants jsonb not null default '{"saved":[]}'::jsonb;

alter table public.generation_jobs
  drop constraint if exists generation_jobs_kind_check;

alter table public.generation_jobs
  add constraint generation_jobs_kind_check
    check (kind in ('initial', 'append', 'variant'));

alter table public.generation_jobs
  add column if not exists variant_labels text[] default null,
  add column if not exists variant_results jsonb not null default '{"variants":[]}'::jsonb;

alter table public.generation_idempotency
  drop constraint if exists generation_idempotency_kind_check;

alter table public.generation_idempotency
  add constraint generation_idempotency_kind_check
    check (kind in ('generate_question', 'regenerate_question', 'variant_roll'));

alter table public.credit_reservations
  drop constraint if exists credit_reservations_kind_check;

alter table public.credit_reservations
  add column if not exists variant_label text default null;

alter table public.credit_reservations
  add constraint credit_reservations_kind_check
    check (kind in ('generate_question', 'regenerate_question', 'variant_roll'));

alter table public.credit_reservations
  add constraint credit_reservations_variant_roll_requires_label_and_order
    check (
      kind <> 'variant_roll'
      or (variant_label is not null and question_order is not null)
    );

alter table public.credit_transactions
  drop constraint if exists credit_transactions_type_check;

alter table public.credit_transactions
  add constraint credit_transactions_type_check
    check (type in (
      'signup_bonus',
      'generate_worksheet',
      'generate_worksheet_refund',
      'regenerate_question',
      'regenerate_question_refund',
      'variant_roll',
      'variant_roll_refund'
    ));

create or replace function public._validate_idempotency_key(p_idempotency_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'Idempotency key required';
  end if;

  if length(p_idempotency_key) > 200 then
    raise exception 'Idempotency key too long';
  end if;

  if p_idempotency_key !~ '^(gen|regen|variant):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:.+$' then
    raise exception 'Invalid idempotency key';
  end if;
end;
$$;

create or replace function public.is_valid_variant_question_roll(p_roll jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_given_value jsonb;
  v_step jsonb;
begin
  if jsonb_typeof(p_roll) is distinct from 'object' then
    return false;
  end if;

  if not (
    p_roll ? 'order'
    and p_roll ? 'given_values'
    and p_roll ? 'solution'
  ) then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_roll) as key
    where key not in ('order', 'given_values', 'solution', 'question_text')
  ) then
    return false;
  end if;

  if jsonb_typeof(p_roll->'order') is distinct from 'number'
    or (p_roll->>'order') !~ '^[0-9]+$'
    or (p_roll->>'order')::integer not between 1 and public.max_worksheet_question_count()
  then
    return false;
  end if;

  if p_roll ? 'question_text' then
    if jsonb_typeof(p_roll->'question_text') is distinct from 'string'
      or length(p_roll->>'question_text') = 0
      or length(p_roll->>'question_text') > 4000
    then
      return false;
    end if;
  end if;

  if jsonb_typeof(p_roll->'given_values') is distinct from 'array'
    or jsonb_array_length(p_roll->'given_values') = 0
    or jsonb_array_length(p_roll->'given_values') > 12
  then
    return false;
  end if;

  for v_given_value in
    select value from jsonb_array_elements(p_roll->'given_values')
  loop
    if not public.is_valid_generation_settings_variable(v_given_value) then
      return false;
    end if;
  end loop;

  if jsonb_typeof(p_roll->'solution') is distinct from 'object'
    or not (p_roll->'solution' ? 'steps')
    or not (p_roll->'solution' ? 'final_answer')
  then
    return false;
  end if;

  if jsonb_typeof(p_roll->'solution'->'steps') is distinct from 'array'
    or jsonb_array_length(p_roll->'solution'->'steps') = 0
    or jsonb_array_length(p_roll->'solution'->'steps') > 24
  then
    return false;
  end if;

  for v_step in
    select value from jsonb_array_elements(p_roll->'solution'->'steps')
  loop
    if jsonb_typeof(v_step) is distinct from 'string'
      or length(v_step #>> '{}') = 0
      or length(v_step #>> '{}') > 2000
    then
      return false;
    end if;
  end loop;

  if not public._jsonb_string_len_ok(p_roll->'solution'->'final_answer', 500) then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.is_valid_variant_question_roll(jsonb) from public;
revoke all on function public.is_valid_variant_question_roll(jsonb) from anon;
revoke all on function public.is_valid_variant_question_roll(jsonb) from authenticated;

create or replace function public.is_valid_worksheet_variant(p_variant jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_roll jsonb;
begin
  if jsonb_typeof(p_variant) is distinct from 'object' then
    return false;
  end if;

  if not (
    p_variant ? 'id'
    and p_variant ? 'label'
    and p_variant ? 'createdAt'
    and p_variant ? 'rolls'
  ) then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_variant) as key
    where key not in ('id', 'label', 'createdAt', 'rolls')
  ) then
    return false;
  end if;

  if jsonb_typeof(p_variant->'id') is distinct from 'string'
    or (p_variant->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return false;
  end if;

  if jsonb_typeof(p_variant->'label') is distinct from 'string'
    or p_variant->>'label' not in ('B', 'C', 'D')
  then
    return false;
  end if;

  if jsonb_typeof(p_variant->'createdAt') is distinct from 'string'
    or length(p_variant->>'createdAt') = 0
  then
    return false;
  end if;

  if jsonb_typeof(p_variant->'rolls') is distinct from 'array'
    or jsonb_array_length(p_variant->'rolls') = 0
    or jsonb_array_length(p_variant->'rolls') > public.max_worksheet_question_count()
  then
    return false;
  end if;

  for v_roll in
    select value from jsonb_array_elements(p_variant->'rolls')
  loop
    if not public.is_valid_variant_question_roll(v_roll) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.is_valid_worksheet_variant(jsonb) from public;
revoke all on function public.is_valid_worksheet_variant(jsonb) from anon;
revoke all on function public.is_valid_worksheet_variant(jsonb) from authenticated;

create or replace function public.is_valid_worksheet_variants(p_variants jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_variant jsonb;
  v_label text;
begin
  if jsonb_typeof(p_variants) is distinct from 'object' then
    return false;
  end if;

  if not (p_variants ? 'saved') then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_variants) as key
    where key <> 'saved'
  ) then
    return false;
  end if;

  if jsonb_typeof(p_variants->'saved') is distinct from 'array'
    or jsonb_array_length(p_variants->'saved') > 3
  then
    return false;
  end if;

  if octet_length(p_variants::text) > 131072 then
    return false;
  end if;

  for v_variant in
    select value from jsonb_array_elements(p_variants->'saved')
  loop
    if not public.is_valid_worksheet_variant(v_variant) then
      return false;
    end if;
  end loop;

  for v_label in
    select v->>'label'
    from jsonb_array_elements(p_variants->'saved') as v
  loop
    if (
      select count(*)
      from jsonb_array_elements(p_variants->'saved') as v2
      where v2->>'label' = v_label
    ) > 1 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.is_valid_worksheet_variants(jsonb) from public;
revoke all on function public.is_valid_worksheet_variants(jsonb) from anon;
revoke all on function public.is_valid_worksheet_variants(jsonb) from authenticated;

create or replace function public.save_worksheet_variants(
  p_worksheet_id uuid,
  p_variants jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_worksheet_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_valid_worksheet_variants(p_variants) then
    return public._generation_error_response('VALIDATION_FAILED', 'Invalid worksheet variants payload.');
  end if;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    return public._generation_error_response('PROFILE_NOT_FOUND', 'Profile not found.');
  end if;

  select w.user_id
  into v_worksheet_user_id
  from public.worksheets w
  where w.id = p_worksheet_id
  for update;

  if v_worksheet_user_id is null or v_worksheet_user_id is distinct from v_profile_id then
    return public._generation_error_response('WORKSHEET_ACCESS_DENIED', 'You do not have access to this worksheet.');
  end if;

  update public.worksheets
  set variants = p_variants,
      updated_at = now()
  where id = p_worksheet_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.save_worksheet_variants(uuid, jsonb) from public;
revoke all on function public.save_worksheet_variants(uuid, jsonb) from anon;
grant execute on function public.save_worksheet_variants(uuid, jsonb) to authenticated;

create or replace function public._refund_credit_reservation_row(
  p_reservation public.credit_reservations
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
  v_refund_type text;
begin
  if p_reservation.kind = 'generate_question' then
    v_refund_type := 'generate_worksheet_refund';
  elsif p_reservation.kind = 'variant_roll' then
    v_refund_type := 'variant_roll_refund';
  else
    v_refund_type := 'regenerate_question_refund';
  end if;

  update public.profiles
  set credit_balance = credit_balance + 1,
      updated_at = now()
  where id = p_reservation.user_id
  returning credit_balance into v_new_balance;

  if not found then
    raise exception 'Profile not found';
  end if;

  insert into public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    worksheet_id,
    question_id
  )
  values (
    p_reservation.user_id,
    v_refund_type,
    1,
    v_new_balance,
    p_reservation.worksheet_id,
    p_reservation.question_id
  );

  delete from public.credit_reservations
  where id = p_reservation.id;

  return v_new_balance;
end;
$$;

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

revoke all on function public.reserve_variant_roll_credit(uuid, text, integer, text) from public;
revoke all on function public.reserve_variant_roll_credit(uuid, text, integer, text) from anon;
grant execute on function public.reserve_variant_roll_credit(uuid, text, integer, text) to authenticated;

create or replace function public.complete_variant_roll_reservation(
  p_reservation_id uuid,
  p_roll jsonb,
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
  v_result jsonb;
begin
  perform public._validate_idempotency_key(p_idempotency_key);

  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_valid_variant_question_roll(p_roll) then
    return public._generation_error_response('VALIDATION_FAILED', 'Invalid variant roll payload.');
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
    return public._generation_error_response('RESERVE_FAILED', 'Variant reservation not found.');
  end if;

  delete from public.credit_reservations
  where id = p_reservation_id;

  select credit_balance
  into v_credit_balance
  from public.profiles
  where id = v_profile_id;

  v_result := jsonb_build_object(
    'success', true,
    'roll', p_roll,
    'creditBalance', v_credit_balance
  );

  update public.generation_idempotency
  set status = 'completed',
      completed_result = v_result,
      reservation_id = null,
      updated_at = now()
  where user_id = v_profile_id
    and idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

revoke all on function public.complete_variant_roll_reservation(uuid, jsonb, text) from public;
revoke all on function public.complete_variant_roll_reservation(uuid, jsonb, text) from anon;
grant execute on function public.complete_variant_roll_reservation(uuid, jsonb, text) to authenticated;

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

revoke all on function public.cancel_variant_roll_reservation(uuid, text) from public;
revoke all on function public.cancel_variant_roll_reservation(uuid, text) from anon;
grant execute on function public.cancel_variant_roll_reservation(uuid, text) to authenticated;

create or replace function public.enqueue_variant_generation_job(
  p_worksheet_id uuid,
  p_variant_labels text[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_worksheet_user_id uuid;
  v_question_count integer;
  v_saved_count integer;
  v_job_id uuid;
  v_label text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_variant_labels is null
    or array_length(p_variant_labels, 1) is null
    or array_length(p_variant_labels, 1) < 1
    or array_length(p_variant_labels, 1) > 3
  then
    raise exception 'Invalid variant labels';
  end if;

  foreach v_label in array p_variant_labels loop
    if v_label not in ('B', 'C', 'D') then
      raise exception 'Invalid variant label';
    end if;
  end loop;

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

  select count(*)
  into v_saved_count
  from public.worksheet_questions wq
  where wq.worksheet_id = p_worksheet_id;

  if v_saved_count < v_question_count then
    raise exception 'Worksheet must be fully generated before creating variants';
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
    last_completed_order,
    variant_labels,
    variant_results
  )
  values (
    v_profile_id,
    p_worksheet_id,
    'variant',
    'queued',
    1,
    v_question_count,
    0,
    p_variant_labels,
    jsonb_build_object('variants', '[]'::jsonb)
  )
  returning id into v_job_id;

  return v_job_id;
end;
$$;

revoke all on function public.enqueue_variant_generation_job(uuid, text[]) from public;
revoke all on function public.enqueue_variant_generation_job(uuid, text[]) from anon;
grant execute on function public.enqueue_variant_generation_job(uuid, text[]) to authenticated;

create or replace function public.update_generation_job_progress(
  p_job_id uuid,
  p_status text,
  p_last_completed_order integer default null,
  p_skipped_orders jsonb default null,
  p_error_message text default null,
  p_inngest_run_id text default null,
  p_variant_results jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status is null or p_status not in ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled') then
    raise exception 'Invalid generation job status';
  end if;

  update public.generation_jobs
  set status = p_status,
      last_completed_order = coalesce(p_last_completed_order, last_completed_order),
      skipped_orders = coalesce(p_skipped_orders, skipped_orders),
      error_message = coalesce(p_error_message, error_message),
      inngest_run_id = coalesce(p_inngest_run_id, inngest_run_id),
      variant_results = coalesce(p_variant_results, variant_results)
  where id = p_job_id;

  if not found then
    raise exception 'Generation job not found';
  end if;
end;
$$;

revoke all on function public.update_generation_job_progress(uuid, text, integer, jsonb, text, text, jsonb) from public;
revoke all on function public.update_generation_job_progress(uuid, text, integer, jsonb, text, text, jsonb) from anon;
revoke all on function public.update_generation_job_progress(uuid, text, integer, jsonb, text, text, jsonb) from authenticated;
grant execute on function public.update_generation_job_progress(uuid, text, integer, jsonb, text, text, jsonb) to service_role;

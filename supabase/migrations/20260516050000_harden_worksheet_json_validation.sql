create or replace function public.is_valid_generation_settings(
  p_settings jsonb
) returns boolean
language plpgsql
immutable
set search_path = public
as $$
begin
  if jsonb_typeof(p_settings) is distinct from 'object' then
    return false;
  end if;

  if not (p_settings ? 'lesson') or not (p_settings ? 'scenario') then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_settings) as key
    where key not in ('lesson', 'scenario')
  ) then
    return false;
  end if;

  return jsonb_typeof(p_settings->'lesson') = 'string'
    and length(p_settings->>'lesson') > 0
    and jsonb_typeof(p_settings->'scenario') = 'string'
    and length(p_settings->>'scenario') > 0;
end;
$$;

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
    or (p_question->>'order')::integer not between 1 and 20
  then
    return false;
  end if;

  if jsonb_typeof(p_question->'question_text') is distinct from 'string'
    or length(p_question->>'question_text') = 0
  then
    return false;
  end if;

  if jsonb_typeof(p_question->'given_values') is distinct from 'array'
    or jsonb_array_length(p_question->'given_values') = 0
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

    if jsonb_typeof(v_given_value->'symbol') is distinct from 'string'
      or length(v_given_value->>'symbol') = 0
      or jsonb_typeof(v_given_value->'label') is distinct from 'string'
      or length(v_given_value->>'label') = 0
      or jsonb_typeof(v_given_value->'value') not in ('number', 'string')
      or (
        v_given_value ? 'unit'
        and jsonb_typeof(v_given_value->'unit') is distinct from 'string'
      )
    then
      return false;
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

  if jsonb_typeof(p_question->'target_variable'->'symbol') is distinct from 'string'
    or length(p_question->'target_variable'->>'symbol') = 0
    or jsonb_typeof(p_question->'target_variable'->'label') is distinct from 'string'
    or length(p_question->'target_variable'->>'label') = 0
    or (
      p_question->'target_variable' ? 'unit'
      and jsonb_typeof(p_question->'target_variable'->'unit') is distinct from 'string'
    )
  then
    return false;
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
  then
    return false;
  end if;

  for v_step in
    select value from jsonb_array_elements(p_question->'solution'->'steps')
  loop
    if jsonb_typeof(v_step) is distinct from 'string' or length(v_step #>> '{}') = 0 then
      return false;
    end if;
  end loop;

  return jsonb_typeof(p_question->'solution'->'final_answer') = 'string'
    and length(p_question->'solution'->>'final_answer') > 0;
end;
$$;

create or replace function public.is_valid_worksheet_questions_array(
  p_questions jsonb,
  p_question_count integer
) returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_question jsonb;
  v_seen_ids text[] := array[]::text[];
  v_seen_orders text[] := array[]::text[];
begin
  if p_question_count is null or p_question_count < 1 or p_question_count > 20 then
    return false;
  end if;

  if jsonb_typeof(p_questions) is distinct from 'array' then
    return false;
  end if;

  if jsonb_array_length(p_questions) > p_question_count then
    return false;
  end if;

  for v_question in
    select value from jsonb_array_elements(p_questions)
  loop
    if not public.is_valid_worksheet_question(v_question) then
      return false;
    end if;

    if (v_question->>'order')::integer > p_question_count then
      return false;
    end if;

    if (v_question->>'id') = any(v_seen_ids)
      or (v_question->>'order') = any(v_seen_orders)
    then
      return false;
    end if;

    v_seen_ids := array_append(v_seen_ids, v_question->>'id');
    v_seen_orders := array_append(v_seen_orders, v_question->>'order');
  end loop;

  return true;
end;
$$;

revoke execute on function public.is_valid_generation_settings(jsonb) from public, anon, authenticated;
revoke execute on function public.is_valid_worksheet_question(jsonb) from public, anon, authenticated;
revoke execute on function public.is_valid_worksheet_questions_array(jsonb, integer) from public, anon, authenticated;

alter table public.worksheets
  drop constraint if exists worksheets_generation_settings_valid,
  add constraint worksheets_generation_settings_valid
    check (generation_settings is null or public.is_valid_generation_settings(generation_settings));

alter table public.worksheets
  drop constraint if exists worksheets_questions_valid,
  add constraint worksheets_questions_valid
    check (public.is_valid_worksheet_questions_array(questions, question_count));

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

  if p_question_count is null or p_question_count < 1 or p_question_count > 20 then
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
    generation_settings,
    questions
  )
  values (
    v_profile_id,
    p_title,
    p_subject,
    p_question_count,
    p_generation_settings,
    '[]'::jsonb
  )
  returning id into v_worksheet_id;

  return v_worksheet_id;
end;
$$;

create or replace function public.append_worksheet_question(
  p_worksheet_id uuid,
  p_question jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current_balance integer;
  v_new_balance integer;
  v_updated_question jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_valid_worksheet_question(p_question) then
    raise exception 'Invalid worksheet question';
  end if;

  select id, credit_balance
  into v_profile_id, v_current_balance
  from public.profiles
  where auth_user_id = auth.uid()
  for update;

  if v_profile_id is null then
    raise exception 'Profile not found';
  end if;

  if v_current_balance < 1 then
    raise exception 'Insufficient credits';
  end if;

  update public.worksheets
  set questions = questions || jsonb_build_array(p_question),
      updated_at = now()
  where id = p_worksheet_id
    and user_id = v_profile_id
    and jsonb_array_length(questions) < question_count
    and (p_question->>'order')::integer <= question_count
    and not exists (
      select 1
      from jsonb_array_elements(questions) as q
      where q->>'order' = p_question->>'order'
         or q->>'id' = p_question->>'id'
    )
  returning p_question into v_updated_question;

  if v_updated_question is null then
    raise exception 'Worksheet not found or already complete';
  end if;

  update public.profiles
  set credit_balance = credit_balance - 1,
      updated_at = now()
  where id = v_profile_id
  returning credit_balance into v_new_balance;

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
    'generate_worksheet',
    -1,
    v_new_balance,
    p_worksheet_id,
    p_question->>'id'
  );

  return jsonb_build_object(
    'question', v_updated_question,
    'creditBalance', v_new_balance
  );
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
  v_question_exists boolean;
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
    raise exception 'Profile not found';
  end if;

  select (q->>'order')::integer
  into v_existing_order
  from public.worksheets w
  cross join jsonb_array_elements(w.questions) as q
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
    and q->>'id' = p_question_id;

  v_question_exists := v_existing_order is not null;

  if not v_question_exists then
    raise exception 'Worksheet or question not found';
  end if;

  if p_edited_question->>'id' <> p_question_id then
    raise exception 'Question id cannot be changed';
  end if;

  if (p_edited_question->>'order')::integer <> v_existing_order then
    raise exception 'Question order cannot be changed';
  end if;

  update public.worksheets
  set questions = (
    select jsonb_agg(
      case
        when q->>'id' = p_question_id then p_edited_question
        else q
      end
      order by (q->>'order')::integer
    )
    from jsonb_array_elements(questions) as q
  ),
  updated_at = now()
  where id = p_worksheet_id
    and user_id = v_profile_id
    and (p_edited_question->>'order')::integer <= question_count
  returning p_edited_question into v_updated_question;

  return v_updated_question;
end;
$$;

create or replace function public.regenerate_question_replace_and_deduct(
  p_worksheet_id uuid,
  p_question_id text,
  p_new_question jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current_balance integer;
  v_cost integer := 1;
  v_new_balance integer;
  v_existing_order integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_valid_worksheet_question(p_new_question) then
    raise exception 'Invalid worksheet question';
  end if;

  select id, credit_balance
  into v_profile_id, v_current_balance
  from public.profiles
  where auth_user_id = auth.uid()
  for update;

  if v_profile_id is null then
    raise exception 'Profile not found';
  end if;

  select (q->>'order')::integer
  into v_existing_order
  from public.worksheets w
  cross join jsonb_array_elements(w.questions) as q
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
    and q->>'id' = p_question_id;

  if v_existing_order is null then
    raise exception 'Worksheet or question not found';
  end if;

  if p_new_question->>'id' <> p_question_id then
    raise exception 'Question id cannot be changed';
  end if;

  if (p_new_question->>'order')::integer <> v_existing_order then
    raise exception 'Question order cannot be changed';
  end if;

  if v_current_balance < v_cost then
    raise exception 'Insufficient credits';
  end if;

  v_new_balance := v_current_balance - v_cost;

  update public.profiles
  set credit_balance = v_new_balance,
      updated_at = now()
  where id = v_profile_id;

  update public.worksheets
  set questions = (
    select jsonb_agg(
      case
        when q->>'id' = p_question_id then p_new_question
        else q
      end
      order by (q->>'order')::integer
    )
    from jsonb_array_elements(questions) as q
  ),
  updated_at = now()
  where id = p_worksheet_id
    and user_id = v_profile_id
    and (p_new_question->>'order')::integer <= question_count;

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
    -v_cost,
    v_new_balance,
    p_worksheet_id,
    p_question_id
  );

  return v_new_balance;
end;
$$;

grant execute on function public.generate_worksheet_init(text, text, integer, jsonb) to authenticated;
grant execute on function public.append_worksheet_question(uuid, jsonb) to authenticated;
grant execute on function public.replace_worksheet_question(uuid, text, jsonb) to authenticated;
grant execute on function public.regenerate_question_replace_and_deduct(uuid, text, jsonb) to authenticated;

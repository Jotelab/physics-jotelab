-- Phase 9: raise worksheet cap to 40 and add extend_worksheet_count RPC

alter table public.worksheets
  drop constraint if exists worksheets_question_count_check;

alter table public.worksheets
  add constraint worksheets_question_count_check
    check (question_count between 1 and 40);

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
    or (p_question->>'order')::integer not between 1 and 40
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
  if p_question_count is null or p_question_count < 1 or p_question_count > 40 then
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

alter table public.worksheets
  drop constraint if exists worksheets_questions_valid,
  add constraint worksheets_questions_valid
    check (public.is_valid_worksheet_questions_array(questions, question_count));

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

  if p_additional_count is null or p_additional_count < 1 or p_additional_count > 20 then
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

  if v_current_count + p_additional_count > 40 then
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

grant execute on function public.extend_worksheet_count(uuid, integer) to authenticated;

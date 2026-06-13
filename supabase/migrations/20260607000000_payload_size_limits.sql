-- P2: payload size limits in JSON validators (mirrors features/generate/limits.ts)
-- MAX_LESSON_LEN=160, MAX_SCENARIO_LEN=500, MAX_SYMBOL_LEN=32, MAX_LABEL_LEN=120,
-- MAX_UNIT_LEN=32, MAX_GIVEN_STRING_VALUE_LEN=64, MAX_GIVEN_VARIABLES=12,
-- MAX_QUESTION_TEXT_LEN=4000, MAX_SOLUTION_STEPS=24, MAX_SOLUTION_STEP_LEN=2000,
-- MAX_FINAL_ANSWER_LEN=500, MAX_QUESTION_JSON_BYTES=32768, MAX_QUESTIONS_ARRAY_BYTES=524288

create or replace function public._jsonb_string_len_ok(p_value jsonb, p_max integer)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(p_value) = 'string'
    and length(p_value #>> '{}') between 1 and p_max;
$$;

revoke all on function public._jsonb_string_len_ok(jsonb, integer) from public;
revoke all on function public._jsonb_string_len_ok(jsonb, integer) from anon;
revoke all on function public._jsonb_string_len_ok(jsonb, integer) from authenticated;

create or replace function public.is_valid_generation_settings_variable(
  p_variable jsonb
) returns boolean
language plpgsql
immutable
set search_path = public
as $$
begin
  if jsonb_typeof(p_variable) is distinct from 'object' then
    return false;
  end if;

  if not (
    p_variable ? 'symbol'
    and p_variable ? 'label'
    and p_variable ? 'value'
  ) then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_variable) as key
    where key not in ('symbol', 'label', 'value', 'unit')
  ) then
    return false;
  end if;

  if not public._jsonb_string_len_ok(p_variable->'symbol', 32)
    or not public._jsonb_string_len_ok(p_variable->'label', 120)
  then
    return false;
  end if;

  if jsonb_typeof(p_variable->'value') = 'string' then
    if not public._jsonb_string_len_ok(p_variable->'value', 64) then
      return false;
    end if;
  elsif jsonb_typeof(p_variable->'value') is distinct from 'number' then
    return false;
  end if;

  if p_variable ? 'unit' then
    if jsonb_typeof(p_variable->'unit') is distinct from 'string'
      or length(p_variable->>'unit') = 0
      or length(p_variable->>'unit') > 32
    then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.is_valid_generation_settings_target_variable(
  p_variable jsonb
) returns boolean
language plpgsql
immutable
set search_path = public
as $$
begin
  if jsonb_typeof(p_variable) is distinct from 'object' then
    return false;
  end if;

  if not (p_variable ? 'symbol' and p_variable ? 'label') then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_variable) as key
    where key not in ('symbol', 'label', 'unit')
  ) then
    return false;
  end if;

  if not public._jsonb_string_len_ok(p_variable->'symbol', 32)
    or not public._jsonb_string_len_ok(p_variable->'label', 120)
  then
    return false;
  end if;

  if p_variable ? 'unit' then
    if jsonb_typeof(p_variable->'unit') is distinct from 'string'
      or length(p_variable->>'unit') = 0
      or length(p_variable->>'unit') > 32
    then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.is_valid_generation_settings(
  p_settings jsonb
) returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_given jsonb;
  v_target jsonb;
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
    where key not in ('lesson', 'scenario', 'given_variables', 'target_variables')
  ) then
    return false;
  end if;

  if jsonb_typeof(p_settings->'lesson') is distinct from 'string'
    or length(p_settings->>'lesson') = 0
    or length(p_settings->>'lesson') > 160
    or jsonb_typeof(p_settings->'scenario') is distinct from 'string'
    or length(p_settings->>'scenario') = 0
    or length(p_settings->>'scenario') > 500
  then
    return false;
  end if;

  if p_settings ? 'given_variables' then
    if jsonb_typeof(p_settings->'given_variables') is distinct from 'array'
      or jsonb_array_length(p_settings->'given_variables') > 12
    then
      return false;
    end if;

    for v_given in
      select value from jsonb_array_elements(p_settings->'given_variables')
    loop
      if not public.is_valid_generation_settings_variable(v_given) then
        return false;
      end if;
    end loop;
  end if;

  if p_settings ? 'target_variables' then
    if jsonb_typeof(p_settings->'target_variables') is distinct from 'array' then
      return false;
    end if;

    if jsonb_array_length(p_settings->'target_variables') > 1 then
      return false;
    end if;

    for v_target in
      select value from jsonb_array_elements(p_settings->'target_variables')
    loop
      if not public.is_valid_generation_settings_target_variable(v_target) then
        return false;
      end if;
    end loop;
  end if;

  return true;
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
    or (p_question->>'order')::integer not between 1 and 40
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

  if octet_length(p_questions) > 524288 then
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

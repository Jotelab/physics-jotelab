-- Local-stack fixes (applied by scripts/local-dev-stack.sh after supabase start).
-- 1) Newer local Postgres lacks the hosted platform's default table grants.
-- 2) octet_length(jsonb) does not resolve on this Postgres — cast to text.
-- How to test: sign in on /login and generate a worksheet; questions save.

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

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
  if octet_length(p_question::text) > 32768 then
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

  if octet_length(p_questions::text) > 524288 then
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

-- Fix `is_valid_worksheet_question` raising 42883 at runtime.
--
-- `octet_length` has no jsonb overload (text/bytea/bit only), so every call to
-- this validator aborted with
--   function octet_length(jsonb) does not exist
-- which surfaced in the product as "Could not save the generated question." for
-- every generated question: `complete_generate_question_reservation` calls this
-- validator, so the whole worksheet generation pipeline failed at the save step
-- and refunded the credits.
--
-- Cast to text for the size check, the same way `is_valid_worksheet_variants`
-- already does. This is the sole change versus the previous definition; the
-- whole body is re-pasted because `create or replace function` has no patch
-- form (see supabase/sql/functions/README.md).

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

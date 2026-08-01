-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260707000000_variant_roll_sympy_data.sql
-- Redefined 2x across: 20260615000000_worksheet_variants.sql, 20260707000000_variant_roll_sympy_data.sql

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
    where key not in ('order', 'given_values', 'solution', 'question_text', 'sympy_data')
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

  if p_roll ? 'sympy_data' then
    if jsonb_typeof(p_roll->'sympy_data') is distinct from 'object' then
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

-- Variant rolls carry the engine's verified `sympy_data` (DEVELOPMENT_PLAN §1.2).
--
-- The anti-cheat variant pipeline now re-rolls engine-backed questions through
-- the symbolic engine (same Given/Find split, fresh seed) instead of letting the
-- LLM recalculate numbers — so a roll, like a question, stores the engine payload
-- it was assembled from, verbatim. This migration:
--   1. permits the optional `sympy_data` key on a variant roll and requires it to
--      be a JSON object (deep shape validation stays app-side, the Zod mirror in
--      `lib/engine/sympy-data.ts` — same split as worksheet questions, see
--      20260705000000_worksheet_question_sympy_data.sql);
--   2. raises the whole-variants octet cap 128KB → 256KB: three variants of a
--      full worksheet now each carry an engine payload (~1–2KB per roll), which
--      the old cap did not budget for.

-- ---------------------------------------------------------------------------
-- 1. Allow the optional `sympy_data` key on a variant roll
-- ---------------------------------------------------------------------------

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

revoke all on function public.is_valid_variant_question_roll(jsonb) from public;
revoke all on function public.is_valid_variant_question_roll(jsonb) from anon;
revoke all on function public.is_valid_variant_question_roll(jsonb) from authenticated;

-- ---------------------------------------------------------------------------
-- 2. Raise the whole-variants octet cap to budget for engine payloads
-- ---------------------------------------------------------------------------

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

  if octet_length(p_variants::text) > 262144 then
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

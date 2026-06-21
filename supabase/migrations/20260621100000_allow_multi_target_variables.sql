-- Fix target_variables cap left at 1 in 20260621000000_generation_settings_difficulty.sql

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
    where key not in (
      'lesson',
      'scenario',
      'given_variables',
      'target_variables',
      'target_randomize',
      'math_complexity',
      'conceptual_difficulty',
      'header'
    )
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

  if p_settings ? 'target_randomize'
    and jsonb_typeof(p_settings->'target_randomize') is distinct from 'boolean'
  then
    return false;
  end if;

  if p_settings ? 'math_complexity'
    and p_settings->>'math_complexity' not in ('integers', 'decimals', 'scientific')
  then
    return false;
  end if;

  if p_settings ? 'conceptual_difficulty'
    and p_settings->>'conceptual_difficulty' not in ('level_1', 'level_2', 'level_3')
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

    -- Mirrors features/generate/limits.ts MAX_TARGET_VARIABLES=6
    if jsonb_array_length(p_settings->'target_variables') > 6 then
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

  if p_settings ? 'header' then
    if not public.is_valid_generation_settings_header(p_settings->'header') then
      return false;
    end if;
  end if;

  return true;
end;
$$;

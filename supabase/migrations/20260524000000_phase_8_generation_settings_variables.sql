-- Phase 8: allow optional given_variables / target_variables in generation_settings

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

  return jsonb_typeof(p_variable->'symbol') = 'string'
    and length(p_variable->>'symbol') > 0
    and jsonb_typeof(p_variable->'label') = 'string'
    and length(p_variable->>'label') > 0
    and jsonb_typeof(p_variable->'value') in ('number', 'string')
    and (
      not (p_variable ? 'unit')
      or jsonb_typeof(p_variable->'unit') = 'string'
    );
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

  return jsonb_typeof(p_variable->'symbol') = 'string'
    and length(p_variable->>'symbol') > 0
    and jsonb_typeof(p_variable->'label') = 'string'
    and length(p_variable->>'label') > 0
    and (
      not (p_variable ? 'unit')
      or jsonb_typeof(p_variable->'unit') = 'string'
    );
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
    or jsonb_typeof(p_settings->'scenario') is distinct from 'string'
    or length(p_settings->>'scenario') = 0
  then
    return false;
  end if;

  if p_settings ? 'given_variables' then
    if jsonb_typeof(p_settings->'given_variables') is distinct from 'array' then
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

revoke execute on function public.is_valid_generation_settings_variable(jsonb) from public, anon, authenticated;
revoke execute on function public.is_valid_generation_settings_target_variable(jsonb) from public, anon, authenticated;

alter table public.worksheets
  drop constraint if exists worksheets_generation_settings_valid,
  add constraint worksheets_generation_settings_valid
    check (generation_settings is null or public.is_valid_generation_settings(generation_settings));

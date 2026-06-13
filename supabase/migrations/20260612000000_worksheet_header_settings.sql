-- Allow optional worksheet header customization in generation_settings.header
-- Mirrors features/generate/limits.ts: MAX_HEADER_TITLE_LEN=120, MAX_HEADER_INSTRUCTIONS_LEN=300

create or replace function public.is_valid_generation_settings_header(
  p_header jsonb
) returns boolean
language plpgsql
immutable
set search_path = public
as $$
begin
  if jsonb_typeof(p_header) is distinct from 'object' then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_header) as key
    where key not in ('title', 'instructions', 'fields')
  ) then
    return false;
  end if;

  if p_header ? 'title' then
    if jsonb_typeof(p_header->'title') is distinct from 'string'
      or length(p_header->>'title') = 0
      or length(p_header->>'title') > 120
    then
      return false;
    end if;
  end if;

  if p_header ? 'instructions' then
    if jsonb_typeof(p_header->'instructions') is distinct from 'string'
      or length(p_header->>'instructions') = 0
      or length(p_header->>'instructions') > 300
    then
      return false;
    end if;
  end if;

  if p_header ? 'fields' then
    if jsonb_typeof(p_header->'fields') is distinct from 'object' then
      return false;
    end if;

    if exists (
      select 1
      from jsonb_object_keys(p_header->'fields') as key
      where key not in (
        'showStudentName',
        'showDate',
        'showClassSection',
        'showScoreBox'
      )
    ) then
      return false;
    end if;

    if (p_header->'fields') ? 'showStudentName'
      and jsonb_typeof(p_header->'fields'->'showStudentName') is distinct from 'boolean'
    then
      return false;
    end if;

    if (p_header->'fields') ? 'showDate'
      and jsonb_typeof(p_header->'fields'->'showDate') is distinct from 'boolean'
    then
      return false;
    end if;

    if (p_header->'fields') ? 'showClassSection'
      and jsonb_typeof(p_header->'fields'->'showClassSection') is distinct from 'boolean'
    then
      return false;
    end if;

    if (p_header->'fields') ? 'showScoreBox'
      and jsonb_typeof(p_header->'fields'->'showScoreBox') is distinct from 'boolean'
    then
      return false;
    end if;
  end if;

  return true;
end;
$$;

revoke all on function public.is_valid_generation_settings_header(jsonb) from public;
revoke all on function public.is_valid_generation_settings_header(jsonb) from anon;
revoke all on function public.is_valid_generation_settings_header(jsonb) from authenticated;

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
    where key not in ('lesson', 'scenario', 'given_variables', 'target_variables', 'header')
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

  if p_settings ? 'header' then
    if not public.is_valid_generation_settings_header(p_settings->'header') then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.update_worksheet_header(
  p_worksheet_id uuid,
  p_header jsonb,
  p_title text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_settings jsonb;
  v_next_settings jsonb;
  v_trimmed_title text;
  v_current_title text;
begin
  select id into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    return jsonb_build_object('success', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not exists (
    select 1
    from public.worksheets w
    where w.id = p_worksheet_id
      and w.user_id = v_profile_id
  ) then
    return jsonb_build_object('success', false, 'code', 'WORKSHEET_ACCESS_DENIED');
  end if;

  if not public.is_valid_generation_settings_header(p_header) then
    return jsonb_build_object('success', false, 'code', 'VALIDATION_FAILED');
  end if;

  select generation_settings, title
  into v_settings, v_current_title
  from public.worksheets
  where id = p_worksheet_id
  for update;

  if v_settings is null then
    return jsonb_build_object('success', false, 'code', 'VALIDATION_FAILED');
  end if;

  v_next_settings := v_settings || jsonb_build_object('header', p_header);

  if not public.is_valid_generation_settings(v_next_settings) then
    return jsonb_build_object('success', false, 'code', 'VALIDATION_FAILED');
  end if;

  v_trimmed_title := nullif(btrim(p_title), '');

  if v_trimmed_title is not null and length(v_trimmed_title) > 120 then
    return jsonb_build_object('success', false, 'code', 'VALIDATION_FAILED');
  end if;

  update public.worksheets
  set
    generation_settings = v_next_settings,
    title = coalesce(v_trimmed_title, title),
    updated_at = now()
  where id = p_worksheet_id;

  return jsonb_build_object(
    'success', true,
    'generation_settings', v_next_settings,
    'title', coalesce(v_trimmed_title, v_current_title)
  );
end;
$$;

revoke all on function public.update_worksheet_header(uuid, jsonb, text) from public;
grant execute on function public.update_worksheet_header(uuid, jsonb, text) to authenticated;

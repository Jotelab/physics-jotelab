-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260612000000_worksheet_header_settings.sql

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

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

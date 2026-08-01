-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260615000000_worksheet_variants.sql

create or replace function public.save_worksheet_variants(
  p_worksheet_id uuid,
  p_variants jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_worksheet_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_valid_worksheet_variants(p_variants) then
    return public._generation_error_response('VALIDATION_FAILED', 'Invalid worksheet variants payload.');
  end if;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    return public._generation_error_response('PROFILE_NOT_FOUND', 'Profile not found.');
  end if;

  select w.user_id
  into v_worksheet_user_id
  from public.worksheets w
  where w.id = p_worksheet_id
  for update;

  if v_worksheet_user_id is null or v_worksheet_user_id is distinct from v_profile_id then
    return public._generation_error_response('WORKSHEET_ACCESS_DENIED', 'You do not have access to this worksheet.');
  end if;

  update public.worksheets
  set variants = p_variants,
      updated_at = now()
  where id = p_worksheet_id;

  return jsonb_build_object('success', true);
end;
$$;

-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260611000000_generation_error_codes.sql

create or replace function public.extend_worksheet_count(
  p_worksheet_id uuid,
  p_additional_count integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current_count integer;
  v_new_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_additional_count is null
    or p_additional_count < 1
    or p_additional_count > public.max_extend_questions_per_request() then
    raise exception 'Invalid additional count';
  end if;

  select p.id
  into v_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid();

  if v_profile_id is null then
    return public._generation_error_response('PROFILE_NOT_FOUND', 'Profile not found.');
  end if;

  select w.question_count
  into v_current_count
  from public.worksheets w
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
  for update;

  if v_current_count is null then
    return public._generation_error_response('WORKSHEET_ACCESS_DENIED', 'You do not have access to this worksheet.');
  end if;

  if v_current_count + p_additional_count > public.max_worksheet_question_count() then
    return public._generation_error_response('VALIDATION_FAILED', 'Worksheet question limit exceeded.');
  end if;

  v_new_count := v_current_count + p_additional_count;

  update public.worksheets
  set question_count = v_new_count,
      updated_at = now()
  where id = p_worksheet_id
    and user_id = v_profile_id;

  return jsonb_build_object('success', true, 'questionCount', v_new_count);
end;
$$;

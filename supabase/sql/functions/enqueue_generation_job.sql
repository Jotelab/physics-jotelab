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

create or replace function public.enqueue_generation_job(
  p_worksheet_id uuid,
  p_from_order integer,
  p_to_order integer,
  p_kind text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_worksheet_user_id uuid;
  v_question_count integer;
  v_job_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_kind is null or p_kind not in ('initial', 'append') then
    raise exception 'Invalid generation job kind';
  end if;

  if p_from_order is null or p_to_order is null
    or p_from_order < 1
    or p_to_order > public.max_worksheet_question_count()
    or p_from_order > p_to_order
  then
    raise exception 'Invalid generation job order range';
  end if;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    return public._generation_error_response('PROFILE_NOT_FOUND', 'Profile not found.');
  end if;

  select w.user_id, w.question_count
  into v_worksheet_user_id, v_question_count
  from public.worksheets w
  where w.id = p_worksheet_id
  for update;

  if v_worksheet_user_id is null or v_worksheet_user_id is distinct from v_profile_id then
    return public._generation_error_response('WORKSHEET_ACCESS_DENIED', 'You do not have access to this worksheet.');
  end if;

  if p_to_order > v_question_count then
    return public._generation_error_response('VALIDATION_FAILED', 'Generation job order range exceeds worksheet question count.');
  end if;

  if exists (
    select 1
    from public.generation_jobs gj
    where gj.worksheet_id = p_worksheet_id
      and gj.status in ('queued', 'running')
  ) then
    return public._generation_error_response('SLOT_ALREADY_RESERVED', 'A generation job is already active for this worksheet.');
  end if;

  insert into public.generation_jobs (
    user_id,
    worksheet_id,
    kind,
    status,
    from_order,
    to_order,
    last_completed_order
  )
  values (
    v_profile_id,
    p_worksheet_id,
    p_kind,
    'queued',
    p_from_order,
    p_to_order,
    0
  )
  returning id into v_job_id;

  return jsonb_build_object('success', true, 'jobId', v_job_id);
end;
$$;

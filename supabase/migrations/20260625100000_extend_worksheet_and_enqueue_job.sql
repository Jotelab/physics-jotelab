-- Make worksheet append atomic.
--
-- The append flow previously called extend_worksheet_count (which commits the new
-- question_count) and then enqueue_generation_job as two separate PostgREST RPCs.
-- If the enqueue failed -- most commonly because a job was already active for the
-- worksheet -- the question_count was left inflated with no job to fill the new
-- slots, and every retry inflated it further.
--
-- This RPC merges both operations into one transaction so the count is never
-- inflated unless a job is created to fill it. Guards run before any write, so a
-- rejected append leaves the worksheet untouched.

create or replace function public.extend_worksheet_and_enqueue_job(
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
  v_job_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_additional_count is null
    or p_additional_count < 1
    or p_additional_count > public.max_extend_questions_per_request() then
    raise exception 'Invalid additional count';
  end if;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

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

  -- Active-job guard runs before any write so a rejected append never inflates the count.
  if exists (
    select 1
    from public.generation_jobs gj
    where gj.worksheet_id = p_worksheet_id
      and gj.status in ('queued', 'running')
  ) then
    return public._generation_error_response('SLOT_ALREADY_RESERVED', 'A generation job is already active for this worksheet.');
  end if;

  v_new_count := v_current_count + p_additional_count;

  update public.worksheets
  set question_count = v_new_count,
      updated_at = now()
  where id = p_worksheet_id
    and user_id = v_profile_id;

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
    'append',
    'queued',
    v_current_count + 1,
    v_new_count,
    0
  )
  returning id into v_job_id;

  return jsonb_build_object('success', true, 'jobId', v_job_id, 'questionCount', v_new_count);
end;
$$;

revoke all on function public.extend_worksheet_and_enqueue_job(uuid, integer) from public;
revoke all on function public.extend_worksheet_and_enqueue_job(uuid, integer) from anon;
grant execute on function public.extend_worksheet_and_enqueue_job(uuid, integer) to authenticated;

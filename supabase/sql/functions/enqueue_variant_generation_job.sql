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

create or replace function public.enqueue_variant_generation_job(
  p_worksheet_id uuid,
  p_variant_labels text[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_worksheet_user_id uuid;
  v_question_count integer;
  v_saved_count integer;
  v_job_id uuid;
  v_label text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_variant_labels is null
    or array_length(p_variant_labels, 1) is null
    or array_length(p_variant_labels, 1) < 1
    or array_length(p_variant_labels, 1) > 3
  then
    raise exception 'Invalid variant labels';
  end if;

  foreach v_label in array p_variant_labels loop
    if v_label not in ('B', 'C', 'D') then
      raise exception 'Invalid variant label';
    end if;
  end loop;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    raise exception 'Profile not found';
  end if;

  select w.user_id, w.question_count
  into v_worksheet_user_id, v_question_count
  from public.worksheets w
  where w.id = p_worksheet_id
  for update;

  if v_worksheet_user_id is null or v_worksheet_user_id is distinct from v_profile_id then
    raise exception 'Worksheet not found';
  end if;

  select count(*)
  into v_saved_count
  from public.worksheet_questions wq
  where wq.worksheet_id = p_worksheet_id;

  if v_saved_count < v_question_count then
    raise exception 'Worksheet must be fully generated before creating variants';
  end if;

  if exists (
    select 1
    from public.generation_jobs gj
    where gj.worksheet_id = p_worksheet_id
      and gj.status in ('queued', 'running')
  ) then
    raise exception 'A generation job is already active for this worksheet';
  end if;

  insert into public.generation_jobs (
    user_id,
    worksheet_id,
    kind,
    status,
    from_order,
    to_order,
    last_completed_order,
    variant_labels,
    variant_results
  )
  values (
    v_profile_id,
    p_worksheet_id,
    'variant',
    'queued',
    1,
    v_question_count,
    0,
    p_variant_labels,
    jsonb_build_object('variants', '[]'::jsonb)
  )
  returning id into v_job_id;

  return v_job_id;
end;
$$;

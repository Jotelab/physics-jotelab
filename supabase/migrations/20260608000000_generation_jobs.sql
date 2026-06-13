-- P2: durable generation jobs for Inngest-backed multi-question generation

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  worksheet_id uuid not null references public.worksheets(id) on delete cascade,
  kind text not null check (kind in ('initial', 'append')),
  status text not null check (
    status in ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled')
  ),
  from_order integer not null check (from_order >= 1 and from_order <= 40),
  to_order integer not null check (to_order >= 1 and to_order <= 40),
  last_completed_order integer check (last_completed_order is null or last_completed_order >= 0),
  skipped_orders jsonb not null default '[]'::jsonb,
  error_message text,
  inngest_run_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generation_jobs_order_range check (from_order <= to_order)
);

create unique index if not exists generation_jobs_one_active_per_worksheet
  on public.generation_jobs (worksheet_id)
  where status in ('queued', 'running');

create index if not exists generation_jobs_user_id_created_at_idx
  on public.generation_jobs (user_id, created_at desc);

create index if not exists generation_jobs_worksheet_id_idx
  on public.generation_jobs (worksheet_id);

alter table public.generation_jobs enable row level security;

drop policy if exists "Users can read own generation jobs" on public.generation_jobs;
create policy "Users can read own generation jobs"
on public.generation_jobs
for select
to authenticated
using (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
);

revoke all on table public.generation_jobs from anon;
grant select on table public.generation_jobs to authenticated;

create or replace function public._touch_generation_job_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists generation_jobs_updated_at on public.generation_jobs;
create trigger generation_jobs_updated_at
  before update on public.generation_jobs
  for each row
  execute function public._touch_generation_job_updated_at();

create or replace function public.enqueue_generation_job(
  p_worksheet_id uuid,
  p_from_order integer,
  p_to_order integer,
  p_kind text
) returns uuid
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
    or p_from_order < 1 or p_to_order > 40 or p_from_order > p_to_order
  then
    raise exception 'Invalid generation job order range';
  end if;

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

  if p_to_order > v_question_count then
    raise exception 'Generation job order range exceeds worksheet question count';
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

  return v_job_id;
end;
$$;

revoke all on function public.enqueue_generation_job(uuid, integer, integer, text) from public;
revoke all on function public.enqueue_generation_job(uuid, integer, integer, text) from anon;
grant execute on function public.enqueue_generation_job(uuid, integer, integer, text) to authenticated;

-- Worker-only updates (service role); not granted to authenticated clients.
create or replace function public.update_generation_job_progress(
  p_job_id uuid,
  p_status text,
  p_last_completed_order integer default null,
  p_skipped_orders jsonb default null,
  p_error_message text default null,
  p_inngest_run_id text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status is null or p_status not in ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled') then
    raise exception 'Invalid generation job status';
  end if;

  update public.generation_jobs
  set status = p_status,
      last_completed_order = coalesce(p_last_completed_order, last_completed_order),
      skipped_orders = coalesce(p_skipped_orders, skipped_orders),
      error_message = coalesce(p_error_message, error_message),
      inngest_run_id = coalesce(p_inngest_run_id, inngest_run_id)
  where id = p_job_id;

  if not found then
    raise exception 'Generation job not found';
  end if;
end;
$$;

revoke all on function public.update_generation_job_progress(uuid, text, integer, jsonb, text, text) from public;
revoke all on function public.update_generation_job_progress(uuid, text, integer, jsonb, text, text) from anon;
revoke all on function public.update_generation_job_progress(uuid, text, integer, jsonb, text, text) from authenticated;
grant execute on function public.update_generation_job_progress(uuid, text, integer, jsonb, text, text) to service_role;

create or replace function public.get_generation_job_for_worker(p_job_id uuid)
returns public.generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.generation_jobs;
begin
  select *
  into v_job
  from public.generation_jobs
  where id = p_job_id;

  if not found then
    raise exception 'Generation job not found';
  end if;

  return v_job;
end;
$$;

revoke all on function public.get_generation_job_for_worker(uuid) from public;
revoke all on function public.get_generation_job_for_worker(uuid) from anon;
revoke all on function public.get_generation_job_for_worker(uuid) from authenticated;
grant execute on function public.get_generation_job_for_worker(uuid) to service_role;

-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260608000000_generation_jobs.sql

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

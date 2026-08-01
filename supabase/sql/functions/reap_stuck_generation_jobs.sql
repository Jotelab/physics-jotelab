-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260627000000_reap_stuck_generation_jobs.sql

create or replace function public.reap_stuck_generation_jobs(p_older_than_minutes integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reaped integer;
begin
  if p_older_than_minutes is null or p_older_than_minutes <= 0 then
    raise exception 'p_older_than_minutes must be a positive integer';
  end if;

  update public.generation_jobs
  set status = 'failed',
      error_message = coalesce(
        error_message,
        'Generation timed out and was reaped by the scheduled sweep.'
      )
  where status in ('queued', 'running')
    and updated_at < now() - make_interval(mins => p_older_than_minutes);

  get diagnostics v_reaped = row_count;
  return v_reaped;
end;
$$;

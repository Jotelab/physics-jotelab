-- Scheduled-sweep companion: reap generation jobs stuck in queued/running.
--
-- The `generation_jobs_one_active_per_worksheet` partial-unique index covers
-- status in ('queued','running'); if an Inngest run dies without reaching
-- onFailure the row stays "active" forever and blocks every future job for that
-- worksheet. The scheduled sweep (Inngest cron) calls this to fail such jobs,
-- freeing the index. Pairs with cleanup_expired_credit_reservations() for the
-- abandoned reservations of those same jobs.

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

revoke all on function public.reap_stuck_generation_jobs(integer) from public;
revoke all on function public.reap_stuck_generation_jobs(integer) from anon;
revoke all on function public.reap_stuck_generation_jobs(integer) from authenticated;
grant execute on function public.reap_stuck_generation_jobs(integer) to service_role;

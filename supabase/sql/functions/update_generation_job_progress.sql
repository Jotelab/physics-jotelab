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

create or replace function public.update_generation_job_progress(
  p_job_id uuid,
  p_status text,
  p_last_completed_order integer default null,
  p_skipped_orders jsonb default null,
  p_error_message text default null,
  p_inngest_run_id text default null,
  p_variant_results jsonb default null
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
      inngest_run_id = coalesce(p_inngest_run_id, inngest_run_id),
      variant_results = coalesce(p_variant_results, variant_results)
  where id = p_job_id;

  if not found then
    raise exception 'Generation job not found';
  end if;
end;
$$;

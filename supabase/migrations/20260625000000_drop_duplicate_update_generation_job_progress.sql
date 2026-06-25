-- 20260615000000_worksheet_variants.sql added a 7-arg update_generation_job_progress
-- (…, p_variant_results jsonb) without dropping the original 6-arg version from
-- 20260608000000_generation_jobs.sql. Because every extra arg has a default, a
-- 6-positional-arg call from the standard worker matches BOTH overloads, so
-- PostgREST raises PGRST203 (could not choose the best candidate function).
-- The 7-arg version is a strict superset (p_variant_results defaults to null),
-- so drop the orphaned 6-arg signature and keep only the 7-arg one.

drop function if exists public.update_generation_job_progress(uuid, text, integer, jsonb, text, text);

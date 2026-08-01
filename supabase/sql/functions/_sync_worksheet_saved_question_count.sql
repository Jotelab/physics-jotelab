-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260609000000_worksheet_questions.sql

create or replace function public._sync_worksheet_saved_question_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.worksheets
    set saved_question_count = saved_question_count + 1,
        updated_at = now()
    where id = new.worksheet_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.worksheets
    set saved_question_count = greatest(saved_question_count - 1, 0),
        updated_at = now()
    where id = old.worksheet_id;
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

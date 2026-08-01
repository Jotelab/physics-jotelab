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

create or replace function public._worksheet_question_row_to_jsonb(
  p_id uuid,
  p_question_order integer,
  p_question_text text,
  p_given_values jsonb,
  p_target_variable jsonb,
  p_solution jsonb
) returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_id::text,
    'order', p_question_order,
    'question_text', p_question_text,
    'given_values', p_given_values,
    'target_variable', p_target_variable,
    'solution', p_solution
  );
$$;

-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260705000000_worksheet_question_sympy_data.sql
-- Redefined 3x across: 20260606000000_generation_idempotency.sql, 20260609000000_worksheet_questions.sql, 20260705000000_worksheet_question_sympy_data.sql

create or replace function public._try_reconcile_completed_regenerate_idempotency(
  p_idempotency public.generation_idempotency,
  p_profile_id uuid,
  p_worksheet_id uuid,
  p_question_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_question jsonb;
  v_credit_balance integer;
  v_result jsonb;
begin
  select public._worksheet_question_row_to_jsonb(
    wq.id,
    wq.question_order,
    wq.question_text,
    wq.given_values,
    wq.target_variable,
    wq.solution,
    wq.sympy_data
  )
  into v_existing_question
  from public.worksheets w
  join public.worksheet_questions wq on wq.worksheet_id = w.id
  where w.id = p_worksheet_id
    and w.user_id = p_profile_id
    and wq.id = p_question_id::uuid
  limit 1;

  if v_existing_question is null then
    return null;
  end if;

  select credit_balance
  into v_credit_balance
  from public.profiles
  where id = p_profile_id;

  v_result := jsonb_build_object(
    'success', true,
    'question', v_existing_question,
    'creditBalance', v_credit_balance
  );

  update public.generation_idempotency
  set status = 'completed',
      completed_result = v_result,
      reservation_id = null,
      updated_at = now()
  where user_id = p_idempotency.user_id
    and idempotency_key = p_idempotency.idempotency_key;

  return v_result || jsonb_build_object('alreadyCompleted', true);
end;
$$;

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
-- Redefined 5x across: 20260516020000_phase_5_append_worksheet_question.sql, 20260516040000_phase_7_per_saved_question_credits.sql, 20260516050000_harden_worksheet_json_validation.sql, 20260601000000_credit_reservations.sql, 20260609000000_worksheet_questions.sql

create or replace function public.append_worksheet_question(
  p_worksheet_id uuid,
  p_question jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current_balance integer;
  v_new_balance integer;
  v_updated_question jsonb;
  v_inserted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_valid_worksheet_question(p_question) then
    raise exception 'Invalid worksheet question';
  end if;

  select id, credit_balance
  into v_profile_id, v_current_balance
  from public.profiles
  where auth_user_id = auth.uid()
  for update;

  if v_profile_id is null then
    raise exception 'Profile not found';
  end if;

  if v_current_balance < 1 then
    raise exception 'Insufficient credits';
  end if;

  insert into public.worksheet_questions (
    id,
    worksheet_id,
    question_order,
    question_text,
    given_values,
    target_variable,
    solution
  )
  select
    (p_question->>'id')::uuid,
    w.id,
    (p_question->>'order')::integer,
    p_question->>'question_text',
    p_question->'given_values',
    p_question->'target_variable',
    p_question->'solution'
  from public.worksheets w
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
    and (select count(*) from public.worksheet_questions wq where wq.worksheet_id = w.id) < w.question_count
    and (p_question->>'order')::integer <= w.question_count
  on conflict do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    raise exception 'Worksheet not found or already complete';
  end if;

  select public._worksheet_question_row_to_jsonb(
    wq.id,
    wq.question_order,
    wq.question_text,
    wq.given_values,
    wq.target_variable,
    wq.solution
  )
  into v_updated_question
  from public.worksheet_questions wq
  where wq.id = v_inserted_id;

  update public.profiles
  set credit_balance = credit_balance - 1,
      updated_at = now()
  where id = v_profile_id
  returning credit_balance into v_new_balance;

  insert into public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    worksheet_id,
    question_id
  )
  values (
    v_profile_id,
    'generate_worksheet',
    -1,
    v_new_balance,
    p_worksheet_id,
    p_question->>'id'
  );

  return jsonb_build_object(
    'question', v_updated_question,
    'creditBalance', v_new_balance
  );
end;
$$;

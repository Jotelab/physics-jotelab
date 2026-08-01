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
-- Redefined 5x across: 20260516010000_phase_3_database_credits.sql, 20260516030000_phase_6_replace_worksheet_question.sql, 20260516050000_harden_worksheet_json_validation.sql, 20260601000000_credit_reservations.sql, 20260609000000_worksheet_questions.sql

create or replace function public.regenerate_question_replace_and_deduct(
  p_worksheet_id uuid,
  p_question_id text,
  p_new_question jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current_balance integer;
  v_cost integer := 1;
  v_new_balance integer;
  v_existing_order integer;
  v_rows_updated integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_valid_worksheet_question(p_new_question) then
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

  select wq.question_order
  into v_existing_order
  from public.worksheets w
  join public.worksheet_questions wq on wq.worksheet_id = w.id
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
    and wq.id = p_question_id::uuid;

  if v_existing_order is null then
    raise exception 'Worksheet or question not found';
  end if;

  if p_new_question->>'id' <> p_question_id then
    raise exception 'Question id cannot be changed';
  end if;

  if (p_new_question->>'order')::integer <> v_existing_order then
    raise exception 'Question order cannot be changed';
  end if;

  if v_current_balance < v_cost then
    raise exception 'Insufficient credits';
  end if;

  v_new_balance := v_current_balance - v_cost;

  update public.profiles
  set credit_balance = v_new_balance,
      updated_at = now()
  where id = v_profile_id;

  update public.worksheet_questions wq
  set question_text = p_new_question->>'question_text',
      given_values = p_new_question->'given_values',
      target_variable = p_new_question->'target_variable',
      solution = p_new_question->'solution'
  from public.worksheets w
  where wq.worksheet_id = w.id
    and w.id = p_worksheet_id
    and w.user_id = v_profile_id
    and wq.id = p_question_id::uuid
    and (p_new_question->>'order')::integer <= w.question_count;

  get diagnostics v_rows_updated = row_count;

  if v_rows_updated = 0 then
    raise exception 'Worksheet or question not found';
  end if;

  update public.worksheets
  set updated_at = now()
  where id = p_worksheet_id;

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
    'regenerate_question',
    -v_cost,
    v_new_balance,
    p_worksheet_id,
    p_question_id
  );

  return v_new_balance;
end;
$$;

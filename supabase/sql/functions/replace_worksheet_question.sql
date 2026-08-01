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
-- Redefined 5x across: 20260516030000_phase_6_replace_worksheet_question.sql, 20260516050000_harden_worksheet_json_validation.sql, 20260609000000_worksheet_questions.sql, 20260611000000_generation_error_codes.sql, 20260705000000_worksheet_question_sympy_data.sql

create or replace function public.replace_worksheet_question(
  p_worksheet_id uuid,
  p_question_id text,
  p_edited_question jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_existing_order integer;
  v_updated_question jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_valid_worksheet_question(p_edited_question) then
    raise exception 'Invalid worksheet question';
  end if;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    return public._generation_error_response('PROFILE_NOT_FOUND', 'Profile not found.');
  end if;

  select wq.question_order
  into v_existing_order
  from public.worksheets w
  join public.worksheet_questions wq on wq.worksheet_id = w.id
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
    and wq.id = p_question_id::uuid;

  if v_existing_order is null then
    return public._generation_error_response('QUESTION_NOT_FOUND', 'Question not found.');
  end if;

  if p_edited_question->>'id' <> p_question_id then
    raise exception 'Question id cannot be changed';
  end if;

  if (p_edited_question->>'order')::integer <> v_existing_order then
    raise exception 'Question order cannot be changed';
  end if;

  update public.worksheet_questions wq
  set question_text = p_edited_question->>'question_text',
      given_values = p_edited_question->'given_values',
      target_variable = p_edited_question->'target_variable',
      solution = p_edited_question->'solution',
      sympy_data = p_edited_question->'sympy_data'
  from public.worksheets w
  where wq.worksheet_id = w.id
    and w.id = p_worksheet_id
    and w.user_id = v_profile_id
    and wq.id = p_question_id::uuid
    and (p_edited_question->>'order')::integer <= w.question_count
  returning public._worksheet_question_row_to_jsonb(
    wq.id,
    wq.question_order,
    wq.question_text,
    wq.given_values,
    wq.target_variable,
    wq.solution,
    wq.sympy_data
  ) into v_updated_question;

  if v_updated_question is null then
    return public._generation_error_response('QUESTION_NOT_FOUND', 'Question not found.');
  end if;

  update public.worksheets
  set updated_at = now()
  where id = p_worksheet_id;

  return jsonb_build_object('success', true, 'question', v_updated_question);
end;
$$;

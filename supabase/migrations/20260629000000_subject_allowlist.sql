-- Replace the hardcoded physics-only subject gate with an allowlist helper.
--
-- Widening the set of supported subjects now requires editing a single
-- IMMUTABLE function (`is_valid_subject`) instead of a check constraint and an
-- inline `<>`/`not in` test inside `generate_worksheet_init`. The TS allowlist
-- lives in features/generate/schemas.ts (`SUBJECTS`); keep the two in sync.

create or replace function public.is_valid_subject(p_subject text)
returns boolean
language sql
immutable
as $$
  select p_subject in ('physics');
$$;

alter table public.worksheets
  drop constraint if exists worksheets_subject_check,
  add constraint worksheets_subject_check check (public.is_valid_subject(subject));

create or replace function public.generate_worksheet_init(
  p_title text,
  p_subject text,
  p_question_count integer,
  p_generation_settings jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current_balance integer;
  v_worksheet_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_subject is null or not public.is_valid_subject(p_subject) then
    raise exception 'Invalid subject';
  end if;

  if p_question_count is null
    or p_question_count < 1
    or p_question_count > public.max_initial_worksheet_question_count() then
    raise exception 'Invalid question count';
  end if;

  if not public.is_valid_generation_settings(p_generation_settings) then
    raise exception 'Invalid generation settings';
  end if;

  select id, credit_balance
  into v_profile_id, v_current_balance
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    return public._generation_error_response('PROFILE_NOT_FOUND', 'Profile not found.');
  end if;

  if v_current_balance < 1 then
    return public._generation_error_response('INSUFFICIENT_CREDITS', 'You do not have enough credits.');
  end if;

  insert into public.worksheets (
    user_id,
    title,
    subject,
    question_count,
    generation_settings
  )
  values (
    v_profile_id,
    p_title,
    p_subject,
    p_question_count,
    p_generation_settings
  )
  returning id into v_worksheet_id;

  return jsonb_build_object('success', true, 'worksheetId', v_worksheet_id);
end;
$$;

grant execute on function public.generate_worksheet_init(text, text, integer, jsonb) to authenticated;

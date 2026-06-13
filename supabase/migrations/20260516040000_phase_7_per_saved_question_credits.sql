create or replace function public.generate_worksheet_init(
  p_title text,
  p_subject text,
  p_question_count integer,
  p_generation_settings jsonb
) returns uuid
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

  if p_subject not in ('math', 'physics', 'chemistry') then
    raise exception 'Invalid subject';
  end if;

  if p_question_count < 1 or p_question_count > 20 then
    raise exception 'Invalid question count';
  end if;

  select id, credit_balance
  into v_profile_id, v_current_balance
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    raise exception 'Profile not found';
  end if;

  if v_current_balance < 1 then
    raise exception 'Insufficient credits';
  end if;

  insert into public.worksheets (
    user_id,
    title,
    subject,
    question_count,
    generation_settings,
    questions
  )
  values (
    v_profile_id,
    p_title,
    p_subject,
    p_question_count,
    p_generation_settings,
    '[]'::jsonb
  )
  returning id into v_worksheet_id;

  return v_worksheet_id;
end;
$$;

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
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
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

  update public.worksheets
  set questions = questions || jsonb_build_array(p_question),
      updated_at = now()
  where id = p_worksheet_id
    and user_id = v_profile_id
    and jsonb_array_length(questions) < question_count
    and not exists (
      select 1
      from jsonb_array_elements(questions) as q
      where q->>'order' = p_question->>'order'
    )
  returning p_question into v_updated_question;

  if v_updated_question is null then
    raise exception 'Worksheet not found or already complete';
  end if;

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

grant execute on function public.generate_worksheet_init(text, text, integer, jsonb) to authenticated;
grant execute on function public.append_worksheet_question(uuid, jsonb) to authenticated;

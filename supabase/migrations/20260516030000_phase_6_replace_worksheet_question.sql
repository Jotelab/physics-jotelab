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
  v_question_exists boolean;
  v_updated_question jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    raise exception 'Profile not found';
  end if;

  select (q->>'order')::integer
  into v_existing_order
  from public.worksheets w
  cross join jsonb_array_elements(w.questions) as q
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
    and q->>'id' = p_question_id;

  v_question_exists := v_existing_order is not null;

  if not v_question_exists then
    raise exception 'Worksheet or question not found';
  end if;

  if p_edited_question->>'id' <> p_question_id then
    raise exception 'Question id cannot be changed';
  end if;

  if (p_edited_question->>'order')::integer <> v_existing_order then
    raise exception 'Question order cannot be changed';
  end if;

  update public.worksheets
  set questions = (
    select jsonb_agg(
      case
        when q->>'id' = p_question_id then p_edited_question
        else q
      end
      order by (q->>'order')::integer
    )
    from jsonb_array_elements(questions) as q
  ),
  updated_at = now()
  where id = p_worksheet_id
    and user_id = v_profile_id
  returning p_edited_question into v_updated_question;

  return v_updated_question;
end;
$$;

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

  select (q->>'order')::integer
  into v_existing_order
  from public.worksheets w
  cross join jsonb_array_elements(w.questions) as q
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
    and q->>'id' = p_question_id;

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

  update public.worksheets
  set questions = (
    select jsonb_agg(
      case
        when q->>'id' = p_question_id then p_new_question
        else q
      end
      order by (q->>'order')::integer
    )
    from jsonb_array_elements(questions) as q
  ),
  updated_at = now()
  where id = p_worksheet_id
    and user_id = v_profile_id;

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

grant execute on function public.replace_worksheet_question(uuid, text, jsonb) to authenticated;
grant execute on function public.regenerate_question_replace_and_deduct(uuid, text, jsonb) to authenticated;

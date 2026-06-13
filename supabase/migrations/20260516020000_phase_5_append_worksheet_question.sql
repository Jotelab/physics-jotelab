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

  return v_updated_question;
end;
$$;

grant execute on function public.append_worksheet_question(uuid, jsonb) to authenticated;

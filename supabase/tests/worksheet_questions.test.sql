-- pgTAP tests for worksheet_questions child table.
-- Run with: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

do $$
declare
  v_auth_user_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_profile_id uuid;
  v_worksheet_id uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    v_auth_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'worksheet-questions-test@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into public.profiles (auth_user_id, email, credit_balance)
  values (v_auth_user_id, 'worksheet-questions-test@example.com', 10)
  on conflict (auth_user_id) do update set credit_balance = 10
  returning id into v_profile_id;

  select id into v_profile_id from public.profiles where auth_user_id = v_auth_user_id;

  insert into public.worksheets (
    id,
    user_id,
    title,
    subject,
    question_count,
    generation_settings
  )
  values (
    v_worksheet_id,
    v_profile_id,
    'Child table test',
    'physics',
    2,
    '{"lesson":"Test","scenario":"Test"}'::jsonb
  )
  on conflict (id) do update
    set question_count = 2,
        saved_question_count = 0;

  delete from public.worksheet_questions where worksheet_id = v_worksheet_id;
end;
$$;

do $$
declare
  v_auth_user_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_profile_id uuid;
  v_worksheet_id uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_reserve_result jsonb;
  v_question jsonb;
  v_count integer;
begin
  select id into v_profile_id from public.profiles where auth_user_id = v_auth_user_id;

  perform set_config('request.jwt.claim.sub', v_auth_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_reserve_result := public.reserve_generate_question_credit(
    v_worksheet_id,
    1,
    'gen:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1'
  );

  v_question := jsonb_build_object(
    'id', v_reserve_result->>'pendingQuestionId',
    'order', 1,
    'question_text', 'จงหาค่า x',
    'given_values', jsonb_build_array(
      jsonb_build_object('symbol', 'a', 'label', 'สัมประสิทธิ์', 'value', 2)
    ),
    'target_variable', jsonb_build_object('symbol', 'x', 'label', 'ค่าที่ไม่ทราบ'),
    'solution', jsonb_build_object(
      'steps', jsonb_build_array('คำนวณ'),
      'final_answer', 'x = 5'
    )
  );

  perform public.complete_generate_question_reservation(
    (v_reserve_result->>'reservationId')::uuid,
    v_question,
    'gen:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1'
  );

  select count(*) into v_count
  from public.worksheet_questions
  where worksheet_id = v_worksheet_id;

  if v_count <> 1 then
    raise exception 'expected one worksheet_questions row, got %', v_count;
  end if;

  perform set_config('test.saved_count', (
    select saved_question_count::text
    from public.worksheets
    where id = v_worksheet_id
  ), true);
end;
$$;

select is(
  current_setting('test.saved_count'),
  '1',
  'saved_question_count increments after complete'
);

select ok(
  public.is_valid_worksheet_question(
    public._worksheet_question_row_to_jsonb(
      wq.id,
      wq.question_order,
      wq.question_text,
      wq.given_values,
      wq.target_variable,
      wq.solution
    )
  ),
  'row json helper produces valid worksheet question'
)
from public.worksheet_questions wq
where wq.worksheet_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
limit 1;

select * from finish();

rollback;

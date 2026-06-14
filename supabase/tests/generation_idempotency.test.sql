-- pgTAP: idempotency keys for generate and regenerate reservation flows.
-- Run with: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

do $$
declare
  v_auth_user_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_profile_id uuid;
  v_worksheet_id uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_reserve_result jsonb;
  v_reserve_retry jsonb;
  v_complete_result jsonb;
  v_complete_retry jsonb;
  v_reservation_id uuid;
  v_balance integer;
  v_question_count integer;
  v_question jsonb;
  v_idempotency_key text := 'gen:' || v_worksheet_id::text || ':1';
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    v_auth_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'idempotency-test@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  )
  on conflict (id) do nothing;

  insert into public.profiles (auth_user_id, email, credit_balance)
  values (v_auth_user_id, 'idempotency-test@example.com', 20)
  on conflict (auth_user_id) do update
    set credit_balance = 20
  returning id into v_profile_id;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = v_auth_user_id;

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
    'Idempotency Test',
    'physics',
    3,
    '{"lesson":"Test","scenario":"Test"}'::jsonb
  )
  on conflict (id) do update
    set user_id = excluded.user_id,
        question_count = 3,
        saved_question_count = 0;

  delete from public.worksheet_questions
  where worksheet_id = v_worksheet_id;

  perform set_config('request.jwt.claim.sub', v_auth_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_reserve_result := public.reserve_generate_question_credit(
    v_worksheet_id,
    1,
    v_idempotency_key
  );
  v_reservation_id := (v_reserve_result->>'reservationId')::uuid;

  v_reserve_retry := public.reserve_generate_question_credit(
    v_worksheet_id,
    1,
    v_idempotency_key
  );

  if (v_reserve_retry->>'reservationId')::uuid <> v_reservation_id then
    raise exception 'expected reserve retry to return same reservation id';
  end if;

  select credit_balance
  into v_balance
  from public.profiles
  where id = v_profile_id;

  if v_balance <> 19 then
    raise exception 'expected single credit deduction (balance 19), got %', v_balance;
  end if;

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

  v_complete_result := public.complete_generate_question_reservation(
    v_reservation_id,
    v_question,
    v_idempotency_key
  );

  if coalesce((v_complete_result->>'success')::boolean, false) <> true then
    raise exception 'expected successful complete';
  end if;

  select count(*)
  into v_question_count
  from public.worksheet_questions
  where worksheet_id = v_worksheet_id;

  if v_question_count <> 1 then
    raise exception 'expected one saved question, got %', v_question_count;
  end if;

  v_complete_retry := public.complete_generate_question_reservation(
    v_reservation_id,
    v_question,
    v_idempotency_key
  );

  if coalesce((v_complete_retry->>'success')::boolean, false) <> true then
    raise exception 'expected successful complete retry';
  end if;

  select count(*)
  into v_question_count
  from public.worksheet_questions
  where worksheet_id = v_worksheet_id;

  if v_question_count <> 1 then
    raise exception 'expected still one question after complete retry, got %', v_question_count;
  end if;

  v_reserve_retry := public.reserve_generate_question_credit(
    v_worksheet_id,
    1,
    v_idempotency_key
  );

  if coalesce((v_reserve_retry->>'alreadyCompleted')::boolean, false) <> true then
    raise exception 'expected alreadyCompleted on reserve after success';
  end if;
end;
$$;

select ok(true, 'reserve retry reuses active reservation without double charge');
select ok(true, 'complete retry returns cached success without duplicate append');
select ok(true, 'reserve after complete returns alreadyCompleted');
select ok(true, 'generation idempotency happy path');

select ok(
  exists (
    select 1
    from pg_proc
    where proname = 'complete_generate_question_reservation'
      and prosrc like '%''code''%'
      and prosrc like '%''success'', false%'
  ),
  'complete_generate_question_reservation returns structured failure with code'
);

select * from finish();

rollback;

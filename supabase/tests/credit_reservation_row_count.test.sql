-- pgTAP tests for complete reservation RPC row-count hardening.
-- Run with: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- Test fixtures
do $$
declare
  v_auth_user_id uuid := '11111111-1111-4111-8111-111111111111';
  v_other_auth_user_id uuid := '22222222-2222-4222-8222-222222222222';
  v_profile_id uuid;
  v_other_profile_id uuid;
  v_worksheet_id uuid;
  v_reservation_id uuid;
  v_reserve_result jsonb;
  v_complete_result jsonb;
  v_question jsonb;
  v_balance integer;
  v_reservation_count integer;
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
  values
    (
      v_auth_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'row-count-test@example.com',
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
    ),
    (
      v_other_auth_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'row-count-other@example.com',
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
  values (v_auth_user_id, 'row-count-test@example.com', 50)
  on conflict (auth_user_id) do update
    set credit_balance = 50
  returning id into v_profile_id;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = v_auth_user_id;

  insert into public.profiles (auth_user_id, email, credit_balance)
  values (v_other_auth_user_id, 'row-count-other@example.com', 10)
  on conflict (auth_user_id) do nothing;

  select id
  into v_other_profile_id
  from public.profiles
  where auth_user_id = v_other_auth_user_id;

  insert into public.worksheets (
    id,
    user_id,
    title,
    subject,
    question_count,
    generation_settings
  )
  values (
    '33333333-3333-4333-8333-333333333333',
    v_profile_id,
    'Row Count Test',
    'math',
    5,
    '{"lesson":"Algebra","scenario":"Solve for x"}'::jsonb
  )
  on conflict (id) do update
    set user_id = excluded.user_id,
        question_count = 5,
        saved_question_count = 0;

  delete from public.worksheet_questions
  where worksheet_id = '33333333-3333-4333-8333-333333333333';

  select id into v_worksheet_id
  from public.worksheets
  where id = '33333333-3333-4333-8333-333333333333';

  v_worksheet_id := '33333333-3333-4333-8333-333333333333';

  v_question := jsonb_build_object(
    'id', '44444444-4444-4444-8444-444444444444',
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

  perform set_config('request.jwt.claim.sub', v_auth_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- Reserve credit for order 1
  v_reserve_result := public.reserve_generate_question_credit(
    v_worksheet_id,
    1,
    'gen:33333333-3333-4333-8333-333333333333:1'
  );
  v_reservation_id := (v_reserve_result->>'reservationId')::uuid;

  v_question := jsonb_set(
    v_question,
    '{id}',
    to_jsonb(v_reserve_result->>'pendingQuestionId')
  );

  select credit_balance
  into v_balance
  from public.profiles
  where id = v_profile_id;

  if v_balance <> 49 then
    raise exception 'expected balance 49 after reserve, got %', v_balance;
  end if;

  -- Simulate lost worksheet ownership before complete (0-row lock path)
  update public.worksheets
  set user_id = v_other_profile_id
  where id = v_worksheet_id;

  v_complete_result := public.complete_generate_question_reservation(
    v_reservation_id,
    v_question,
    'gen:33333333-3333-4333-8333-333333333333:1'
  );

  if coalesce((v_complete_result->>'success')::boolean, true) <> false then
    raise exception 'expected success=false after worksheet lock failure';
  end if;

  if v_complete_result->>'message' is null then
    raise exception 'expected failure message in complete response';
  end if;

  if v_complete_result->>'code' is null then
    raise exception 'expected failure code in complete response';
  end if;

  select credit_balance
  into v_balance
  from public.profiles
  where id = v_profile_id;

  if v_balance <> 50 then
    raise exception 'expected balance 50 after auto-refund, got %', v_balance;
  end if;

  select count(*)
  into v_reservation_count
  from public.credit_reservations
  where id = v_reservation_id;

  if v_reservation_count <> 0 then
    raise exception 'expected reservation to be removed after auto-refund';
  end if;

  -- Restore worksheet ownership for success-path test
  update public.worksheets
  set user_id = v_profile_id
  where id = v_worksheet_id;

  delete from public.worksheet_questions
  where worksheet_id = v_worksheet_id;

  -- Success path: reserve + complete
  v_reserve_result := public.reserve_generate_question_credit(
    v_worksheet_id,
    1,
    'gen:33333333-3333-4333-8333-333333333333:1'
  );
  v_reservation_id := (v_reserve_result->>'reservationId')::uuid;

  v_question := jsonb_set(
    v_question,
    '{id}',
    to_jsonb(v_reserve_result->>'pendingQuestionId')
  );

  v_complete_result := public.complete_generate_question_reservation(
    v_reservation_id,
    v_question,
    'gen:33333333-3333-4333-8333-333333333333:1'
  );

  if coalesce((v_complete_result->>'success')::boolean, false) <> true then
    raise exception 'expected success=true on complete';
  end if;

  select count(*)
  into v_reservation_count
  from public.credit_reservations
  where id = v_reservation_id;

  if v_reservation_count <> 0 then
    raise exception 'expected reservation deleted after successful complete';
  end if;

  select credit_balance
  into v_balance
  from public.profiles
  where id = v_profile_id;

  if v_balance <> 49 then
    raise exception 'expected balance 49 after successful complete, got %', v_balance;
  end if;

  -- Regenerate zero-row path: reserve then remove target question
  delete from public.worksheet_questions
  where worksheet_id = v_worksheet_id;

  insert into public.worksheet_questions (
    id,
    worksheet_id,
    question_order,
    question_text,
    given_values,
    target_variable,
    solution
  )
  values (
    (v_question->>'id')::uuid,
    v_worksheet_id,
    (v_question->>'order')::integer,
    v_question->>'question_text',
    v_question->'given_values',
    v_question->'target_variable',
    v_question->'solution'
  )
  on conflict (id) do update
    set question_text = excluded.question_text,
        given_values = excluded.given_values,
        target_variable = excluded.target_variable,
        solution = excluded.solution;

  v_reserve_result := public.reserve_regenerate_question_credit(
    v_worksheet_id,
    v_question->>'id',
    'regen:33333333-3333-4333-8333-333333333333:' || (v_question->>'id')
  );
  v_reservation_id := (v_reserve_result->>'reservationId')::uuid;

  delete from public.worksheet_questions
  where worksheet_id = v_worksheet_id;

  v_complete_result := public.complete_regenerate_question_reservation(
    v_reservation_id,
    v_question,
    'regen:33333333-3333-4333-8333-333333333333:' || (v_question->>'id')
  );

  if coalesce((v_complete_result->>'success')::boolean, true) <> false then
    raise exception 'expected regenerate complete success=false after question removed';
  end if;

  if v_complete_result->>'code' is null then
    raise exception 'expected failure code in regenerate complete response';
  end if;

  select credit_balance
  into v_balance
  from public.profiles
  where id = v_profile_id;

  if v_balance <> 49 then
    raise exception 'expected balance 49 after regenerate auto-refund, got %', v_balance;
  end if;
end;
$$;

select ok(true, 'complete_generate zero-row auto-refunds credit and clears reservation');
select ok(true, 'complete_generate success deletes reservation and keeps deducted credit');
select ok(true, 'complete_regenerate zero-row auto-refunds credit');

select ok(
  exists (
    select 1
    from pg_proc
    where proname = 'complete_generate_question_reservation'
      and prosrc like '%for update%'
      and prosrc like '%_refund_credit_reservation_row%'
  ),
  'complete_generate_question_reservation locks worksheet and auto-refunds on failure'
);

select ok(
  exists (
    select 1
    from pg_proc
    where proname = 'complete_regenerate_question_reservation'
      and prosrc like '%for update%'
      and prosrc like '%_refund_credit_reservation_row%'
  ),
  'complete_regenerate_question_reservation locks worksheet and auto-refunds on failure'
);

select ok(
  exists (
    select 1
    from pg_proc
    where proname = 'complete_generate_question_reservation'
      and prosrc like '%get diagnostics%'
  ),
  'complete_generate_question_reservation checks row count after update'
);

select ok(
  exists (
    select 1
    from pg_proc
    where proname = 'complete_regenerate_question_reservation'
      and prosrc like '%get diagnostics%'
  ),
  'complete_regenerate_question_reservation checks row count after update'
);

select ok(
  exists (
    select 1
    from pg_proc
    where proname = 'complete_generate_question_reservation'
      and prosrc like '%''success'', true%'
  ),
  'complete_generate_question_reservation returns success flag on happy path'
);

select ok(
  exists (
    select 1
    from pg_proc
    where proname = 'complete_regenerate_question_reservation'
      and prosrc like '%''success'', false%'
      and prosrc like '%''code''%'
  ),
  'complete_regenerate_question_reservation returns structured failure with code'
);

select ok(
  exists (
    select 1
    from pg_proc
    where proname = 'reserve_generate_question_credit'
      and prosrc like '%_generation_error_response%'
  ),
  'reserve_generate_question_credit returns structured reserve failures with code'
);

select * from finish();

rollback;

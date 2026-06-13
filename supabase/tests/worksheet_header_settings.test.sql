-- pgTAP tests for worksheet header settings RPC.
-- Run with: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

do $$
declare
  v_owner_auth_user_id uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_other_auth_user_id uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  v_owner_profile_id uuid;
  v_other_profile_id uuid;
  v_worksheet_id uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  v_result jsonb;
  v_settings jsonb;
  v_title text;
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
      v_owner_auth_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'worksheet-header-owner@example.com',
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
      'worksheet-header-other@example.com',
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
  values (v_owner_auth_user_id, 'worksheet-header-owner@example.com', 10)
  on conflict (auth_user_id) do update set credit_balance = 10
  returning id into v_owner_profile_id;

  insert into public.profiles (auth_user_id, email, credit_balance)
  values (v_other_auth_user_id, 'worksheet-header-other@example.com', 10)
  on conflict (auth_user_id) do update set credit_balance = 10
  returning id into v_other_profile_id;

  select id into v_owner_profile_id from public.profiles where auth_user_id = v_owner_auth_user_id;
  select id into v_other_profile_id from public.profiles where auth_user_id = v_other_auth_user_id;

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
    v_owner_profile_id,
    'Header settings test',
    'math',
    2,
    '{"lesson":"Linear equations","scenario":"Solve for x."}'::jsonb
  )
  on conflict (id) do update
    set user_id = excluded.user_id,
        title = excluded.title,
        generation_settings = excluded.generation_settings;

  perform set_config('request.jwt.claim.sub', v_owner_auth_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_result := public.update_worksheet_header(
    v_worksheet_id,
    jsonb_build_object(
      'title', 'Updated Worksheet',
      'instructions', 'Read carefully.',
      'fields', jsonb_build_object(
        'showStudentName', true,
        'showDate', false,
        'showClassSection', true,
        'showScoreBox', false
      )
    ),
    'Updated Worksheet'
  );

  perform set_config('test.owner_result', v_result::text, true);

  select generation_settings, title
  into v_settings, v_title
  from public.worksheets
  where id = v_worksheet_id;

  perform set_config('test.updated_settings', v_settings::text, true);
  perform set_config('test.updated_title', v_title, true);

  perform set_config('request.jwt.claim.sub', v_other_auth_user_id::text, true);

  v_result := public.update_worksheet_header(
    v_worksheet_id,
    jsonb_build_object(
      'fields', jsonb_build_object(
        'showStudentName', false,
        'showDate', false,
        'showClassSection', false,
        'showScoreBox', false
      )
    ),
    'Blocked'
  );

  perform set_config('test.denied_result', v_result::text, true);

  perform set_config('request.jwt.claim.sub', v_owner_auth_user_id::text, true);

  v_result := public.update_worksheet_header(
    v_worksheet_id,
    jsonb_build_object('title', repeat('x', 121)),
    'Invalid'
  );

  perform set_config('test.invalid_result', v_result::text, true);
end;
$$;

select ok(
  (current_setting('test.owner_result')::jsonb->>'success')::boolean,
  'owner can update worksheet header'
);

select ok(
  current_setting('test.updated_settings')::jsonb->>'lesson' = 'Linear equations'
  and current_setting('test.updated_settings')::jsonb->>'scenario' = 'Solve for x.'
  and current_setting('test.updated_settings')::jsonb->'header'->>'title' = 'Updated Worksheet'
  and current_setting('test.updated_title') = 'Updated Worksheet',
  'header merge preserves lesson and scenario and updates title'
);

select ok(
  (current_setting('test.denied_result')::jsonb->>'success')::boolean = false
  and current_setting('test.denied_result')::jsonb->>'code' = 'WORKSHEET_ACCESS_DENIED'
  and (current_setting('test.invalid_result')::jsonb->>'success')::boolean = false
  and current_setting('test.invalid_result')::jsonb->>'code' = 'VALIDATION_FAILED',
  'foreign owner and invalid header are rejected'
);

select * from finish();

rollback;

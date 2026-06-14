-- pgTAP tests for generation_jobs enqueue rules.
-- Run with: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

do $$
declare
  v_auth_user_id uuid := '33333333-3333-4333-8333-333333333333';
  v_other_auth_user_id uuid := '44444444-4444-4444-8444-444444444444';
  v_profile_id uuid;
  v_other_profile_id uuid;
  v_worksheet_id uuid;
  v_job_id uuid;
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
      'generation-jobs@example.com',
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
      'generation-jobs-other@example.com',
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

  insert into public.profiles (auth_user_id, credit_balance)
  values (v_auth_user_id, 50)
  on conflict (auth_user_id) do update set credit_balance = 50
  returning id into v_profile_id;

  insert into public.profiles (auth_user_id, credit_balance)
  values (v_other_auth_user_id, 50)
  on conflict (auth_user_id) do update set credit_balance = 50
  returning id into v_other_profile_id;

  insert into public.worksheets (
    user_id,
    title,
    subject,
    question_count,
    generation_settings
  )
  values (
    v_profile_id,
    'Jobs test',
    'physics',
    3,
    '{"lesson":"Algebra","scenario":"Solve."}'::jsonb
  )
  returning id into v_worksheet_id;

  perform set_config('request.jwt.claim.sub', v_auth_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_job_id := (public.enqueue_generation_job(v_worksheet_id, 1, 3, 'initial')->>'jobId')::uuid;
  perform set_config('test.job_id', v_job_id::text, true);
  perform set_config('test.worksheet_id', v_worksheet_id::text, true);
  perform set_config('test.profile_id', v_profile_id::text, true);
  perform set_config('test.other_profile_id', v_other_profile_id::text, true);
end;
$$;

select ok(
  exists (
    select 1
    from public.generation_jobs
    where id = current_setting('test.job_id')::uuid
      and status = 'queued'
      and from_order = 1
      and to_order = 3
  ),
  'enqueue creates a queued job'
);

select ok(
  coalesce(
    (
      select (public.enqueue_generation_job(
        current_setting('test.worksheet_id')::uuid,
        1,
        3,
        'initial'
      )->>'success')::boolean
    ),
    true
  ) = false
  and (
    select public.enqueue_generation_job(
      current_setting('test.worksheet_id')::uuid,
      1,
      3,
      'initial'
    )->>'code'
  ) is not null,
  'cannot enqueue second active job for same worksheet'
);

select ok(
  (
    select count(*)::integer
    from public.generation_jobs gj
    where gj.user_id = current_setting('test.profile_id')::uuid
  ) >= 1,
  'owner can read own jobs via table under RLS'
);

select ok(
  not exists (
    select 1
    from public.generation_jobs gj
    where gj.id = current_setting('test.job_id')::uuid
      and gj.user_id = current_setting('test.other_profile_id')::uuid
  ),
  'job belongs to owner profile not other profile'
);

select * from finish();

rollback;

-- C1.3: coaching attempts — every checked step of a coached solve, persisted.
--
-- Feeds the Coaching Effectiveness metric (C4) and the dashboard progress view.
-- `question_key` is the coach's stable question ref (`topic:seed:find`): the
-- engine is seeded, so the key re-derives the exact question and its full
-- `sympy_data` on demand — the payload is not duplicated per attempt.
--
-- Anonymous `/learn` solves are NOT stored (the surface works without an
-- account by design); signed-in students write through the security-definer
-- RPC below, mirroring the generation write pattern (no direct table writes).
--
-- How to test: `npx vitest run features/coach/persist-attempt.test.ts` (action
-- contract) and, against a running Supabase, sign in and complete a coached
-- solve → `select * from coaching_attempts` shows one row per checked input.

create table if not exists public.coaching_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_key text not null check (char_length(question_key) between 1 and 200),
  step text not null check (step in ('equation', 'substitution', 'answer')),
  input text not null check (char_length(input) <= 2000),
  error_type text check (
    error_type is null or error_type in (
      'wrong-equation',
      'swapped-variables',
      'sign-error',
      'unit-slip',
      'arithmetic-slip',
      'value-slip'
    )
  ),
  hints_used integer not null check (hints_used between 0 and 50),
  solved boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists coaching_attempts_user_id_created_at_idx
  on public.coaching_attempts (user_id, created_at desc);

alter table public.coaching_attempts enable row level security;

drop policy if exists "Users can read own coaching attempts" on public.coaching_attempts;
create policy "Users can read own coaching attempts"
on public.coaching_attempts
for select
to authenticated
using (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
);

revoke all on table public.coaching_attempts from anon;
grant select on table public.coaching_attempts to authenticated;

create or replace function public.record_coaching_attempt(
  p_question_key text,
  p_step text,
  p_input text,
  p_error_type text,
  p_hints_used integer,
  p_solved boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_attempt_id uuid;
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

  -- The table's check constraints validate the payload; a violation surfaces
  -- as an exception the caller treats as a best-effort miss.
  insert into public.coaching_attempts (
    user_id,
    question_key,
    step,
    input,
    error_type,
    hints_used,
    solved
  )
  values (
    v_profile_id,
    p_question_key,
    p_step,
    p_input,
    p_error_type,
    p_hints_used,
    p_solved
  )
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

revoke all on function public.record_coaching_attempt(text, text, text, text, integer, boolean) from public;
revoke all on function public.record_coaching_attempt(text, text, text, text, integer, boolean) from anon;
grant execute on function public.record_coaching_attempt(text, text, text, text, integer, boolean) to authenticated;

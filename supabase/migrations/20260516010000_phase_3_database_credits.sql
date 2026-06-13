create table if not exists public.worksheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  subject text not null check (subject in ('math', 'physics', 'chemistry')),
  question_count integer not null check (question_count between 1 and 20),
  generation_settings jsonb,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'credit_transactions_worksheet_id_fkey'
      and conrelid = 'public.credit_transactions'::regclass
  ) then
    alter table public.credit_transactions
      add constraint credit_transactions_worksheet_id_fkey
      foreign key (worksheet_id)
      references public.worksheets(id)
      on delete set null;
  end if;
end;
$$;

alter table public.worksheets enable row level security;

drop policy if exists "Users can read own worksheets" on public.worksheets;
create policy "Users can read own worksheets"
on public.worksheets
for select
using (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own worksheets" on public.worksheets;
create policy "Users can delete own worksheets"
on public.worksheets
for delete
using (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
);

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
  v_cost integer;
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

  v_cost := p_question_count;

  select id, credit_balance
  into v_profile_id, v_current_balance
  from public.profiles
  where auth_user_id = auth.uid()
  for update;

  if v_profile_id is null then
    raise exception 'Profile not found';
  end if;

  if v_current_balance < v_cost then
    raise exception 'Insufficient credits';
  end if;

  update public.profiles
  set credit_balance = credit_balance - v_cost,
      updated_at = now()
  where id = v_profile_id;

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

  insert into public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    worksheet_id
  )
  values (
    v_profile_id,
    'generate_worksheet',
    -v_cost,
    v_current_balance - v_cost,
    v_worksheet_id
  );

  return v_worksheet_id;
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
  v_question_exists boolean;
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

  select exists (
    select 1
    from public.worksheets w
    where w.id = p_worksheet_id
      and w.user_id = v_profile_id
      and exists (
        select 1
        from jsonb_array_elements(w.questions) as q
        where q->>'id' = p_question_id
      )
  )
  into v_question_exists;

  if not v_question_exists then
    raise exception 'Worksheet or question not found';
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

grant execute on function public.generate_worksheet_init(text, text, integer, jsonb) to authenticated;
grant execute on function public.regenerate_question_replace_and_deduct(uuid, text, jsonb) to authenticated;

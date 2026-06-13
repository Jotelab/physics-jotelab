create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  credit_balance integer not null default 0 check (credit_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('signup_bonus', 'generate_worksheet', 'regenerate_question')),
  amount integer not null,
  balance_after integer not null,
  worksheet_id uuid,
  question_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists credit_transactions_one_signup_bonus
on public.credit_transactions (user_id)
where type = 'signup_bonus';

alter table public.profiles enable row level security;
alter table public.credit_transactions enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
using (auth.uid() = auth_user_id);

drop policy if exists "Users can read own credit transactions" on public.credit_transactions;
create policy "Users can read own credit transactions"
on public.credit_transactions
for select
using (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
);

create or replace function public.ensure_user_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (
    auth_user_id,
    email,
    display_name,
    avatar_url,
    credit_balance
  )
  values (
    auth.uid(),
    coalesce(auth.jwt()->>'email', ''),
    nullif(auth.jwt()->'user_metadata'->>'full_name', ''),
    nullif(auth.jwt()->'user_metadata'->>'avatar_url', ''),
    50
  )
  on conflict (auth_user_id) do nothing
  returning * into v_profile;

  if found then
    insert into public.credit_transactions (
      user_id,
      type,
      amount,
      balance_after
    )
    values (
      v_profile.id,
      'signup_bonus',
      50,
      50
    )
    on conflict do nothing;

    return v_profile;
  end if;

  select *
  into v_profile
  from public.profiles
  where auth_user_id = auth.uid();

  return v_profile;
end;
$$;

grant execute on function public.ensure_user_profile() to authenticated;

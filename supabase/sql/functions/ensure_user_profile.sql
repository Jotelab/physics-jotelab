-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260516000000_phase_2_auth_profiles.sql

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

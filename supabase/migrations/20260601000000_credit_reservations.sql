-- Credit reservations: deduct and lock slots before AI generation completes.

alter table public.credit_transactions
  drop constraint if exists credit_transactions_type_check;

alter table public.credit_transactions
  add constraint credit_transactions_type_check
    check (type in (
      'signup_bonus',
      'generate_worksheet',
      'generate_worksheet_refund',
      'regenerate_question',
      'regenerate_question_refund'
    ));

create table if not exists public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  worksheet_id uuid not null references public.worksheets(id) on delete cascade,
  kind text not null check (kind in ('generate_question', 'regenerate_question')),
  question_order integer,
  question_id text,
  credit_transaction_id uuid not null references public.credit_transactions(id),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  constraint credit_reservations_generate_requires_order
    check (kind <> 'generate_question' or question_order is not null),
  constraint credit_reservations_regenerate_requires_question_id
    check (kind <> 'regenerate_question' or question_id is not null)
);

create unique index if not exists credit_reservations_one_active_generate_slot
  on public.credit_reservations (worksheet_id, question_order)
  where kind = 'generate_question';

create unique index if not exists credit_reservations_one_active_regenerate
  on public.credit_reservations (worksheet_id, question_id)
  where kind = 'regenerate_question';

create index if not exists credit_reservations_expires_at_idx
  on public.credit_reservations (expires_at);

alter table public.credit_reservations enable row level security;

drop policy if exists "Users can read own credit reservations" on public.credit_reservations;
create policy "Users can read own credit reservations"
on public.credit_reservations
for select
using (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
);

create or replace function public._refund_credit_reservation_row(
  p_reservation public.credit_reservations
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
  v_refund_type text;
begin
  if p_reservation.kind = 'generate_question' then
    v_refund_type := 'generate_worksheet_refund';
  else
    v_refund_type := 'regenerate_question_refund';
  end if;

  update public.profiles
  set credit_balance = credit_balance + 1,
      updated_at = now()
  where id = p_reservation.user_id
  returning credit_balance into v_new_balance;

  if not found then
    raise exception 'Profile not found';
  end if;

  insert into public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    worksheet_id,
    question_id
  )
  values (
    p_reservation.user_id,
    v_refund_type,
    1,
    v_new_balance,
    p_reservation.worksheet_id,
    p_reservation.question_id
  );

  delete from public.credit_reservations
  where id = p_reservation.id;

  return v_new_balance;
end;
$$;

revoke all on function public._refund_credit_reservation_row(public.credit_reservations) from public;

create or replace function public._cleanup_expired_reservations_for_user(
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.credit_reservations;
begin
  for v_reservation in
    select *
    from public.credit_reservations
    where user_id = p_user_id
      and expires_at < now()
    for update
  loop
    perform public._refund_credit_reservation_row(v_reservation);
  end loop;
end;
$$;

revoke all on function public._cleanup_expired_reservations_for_user(uuid) from public;

create or replace function public.cleanup_expired_credit_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.credit_reservations;
  v_cleaned integer := 0;
begin
  for v_reservation in
    select *
    from public.credit_reservations
    where expires_at < now()
    for update
  loop
    perform public._refund_credit_reservation_row(v_reservation);
    v_cleaned := v_cleaned + 1;
  end loop;

  return v_cleaned;
end;
$$;

revoke all on function public.cleanup_expired_credit_reservations() from public;
grant execute on function public.cleanup_expired_credit_reservations() to service_role;

create or replace function public.reserve_generate_question_credit(
  p_worksheet_id uuid,
  p_order integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current_balance integer;
  v_new_balance integer;
  v_question_count integer;
  v_reservation_id uuid;
  v_credit_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_order is null or p_order < 1 or p_order > 40 then
    raise exception 'Invalid question order';
  end if;

  select id, credit_balance
  into v_profile_id, v_current_balance
  from public.profiles
  where auth_user_id = auth.uid()
  for update;

  if v_profile_id is null then
    raise exception 'Profile not found';
  end if;

  perform public._cleanup_expired_reservations_for_user(v_profile_id);

  if v_current_balance < 1 then
    raise exception 'Insufficient credits';
  end if;

  select w.question_count
  into v_question_count
  from public.worksheets w
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
  for update;

  if v_question_count is null then
    raise exception 'Worksheet not found';
  end if;

  if p_order > v_question_count then
    raise exception 'Worksheet or question not found or already complete';
  end if;

  if exists (
    select 1
    from public.worksheets w
    cross join jsonb_array_elements(w.questions) as q
    where w.id = p_worksheet_id
      and (q->>'order')::integer = p_order
  ) then
    raise exception 'Slot already reserved or already complete';
  end if;

  if exists (
    select 1
    from public.credit_reservations cr
    where cr.worksheet_id = p_worksheet_id
      and cr.kind = 'generate_question'
      and cr.question_order = p_order
  ) then
    raise exception 'Slot already reserved or already complete';
  end if;

  v_new_balance := v_current_balance - 1;

  update public.profiles
  set credit_balance = v_new_balance,
      updated_at = now()
  where id = v_profile_id;

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
    -1,
    v_new_balance,
    p_worksheet_id
  )
  returning id into v_credit_transaction_id;

  insert into public.credit_reservations (
    user_id,
    worksheet_id,
    kind,
    question_order,
    credit_transaction_id
  )
  values (
    v_profile_id,
    p_worksheet_id,
    'generate_question',
    p_order,
    v_credit_transaction_id
  )
  returning id into v_reservation_id;

  return jsonb_build_object(
    'reservationId', v_reservation_id,
    'creditBalance', v_new_balance
  );
end;
$$;

create or replace function public.complete_generate_question_reservation(
  p_reservation_id uuid,
  p_question jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.credit_reservations;
  v_profile_id uuid;
  v_credit_balance integer;
  v_updated_question jsonb;
  v_rows_updated integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_valid_worksheet_question(p_question) then
    raise exception 'Invalid worksheet question';
  end if;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    raise exception 'Profile not found';
  end if;

  select *
  into v_reservation
  from public.credit_reservations
  where id = p_reservation_id
    and user_id = v_profile_id
  for update;

  if not found then
    raise exception 'Reservation not found';
  end if;

  if v_reservation.expires_at < now() then
    raise exception 'Reservation expired';
  end if;

  if v_reservation.kind <> 'generate_question' then
    raise exception 'Reservation not found';
  end if;

  if (p_question->>'order')::integer <> v_reservation.question_order then
    raise exception 'Question order does not match reservation';
  end if;

  update public.worksheets
  set questions = questions || jsonb_build_array(p_question),
      updated_at = now()
  where id = v_reservation.worksheet_id
    and user_id = v_profile_id
    and jsonb_array_length(questions) < question_count
    and (p_question->>'order')::integer <= question_count
    and not exists (
      select 1
      from jsonb_array_elements(questions) as q
      where q->>'order' = p_question->>'order'
         or q->>'id' = p_question->>'id'
    )
  returning p_question into v_updated_question;

  get diagnostics v_rows_updated = row_count;

  if v_rows_updated = 0 or v_updated_question is null then
    raise exception 'Worksheet not found or already complete';
  end if;

  update public.credit_transactions
  set question_id = p_question->>'id'
  where id = v_reservation.credit_transaction_id;

  delete from public.credit_reservations
  where id = v_reservation.id;

  select credit_balance
  into v_credit_balance
  from public.profiles
  where id = v_profile_id;

  return jsonb_build_object(
    'question', v_updated_question,
    'creditBalance', v_credit_balance
  );
end;
$$;

create or replace function public.cancel_generate_question_reservation(
  p_reservation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.credit_reservations;
  v_profile_id uuid;
  v_new_balance integer;
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

  select *
  into v_reservation
  from public.credit_reservations
  where id = p_reservation_id
    and user_id = v_profile_id
  for update;

  if not found then
    raise exception 'Reservation not found';
  end if;

  if v_reservation.kind <> 'generate_question' then
    raise exception 'Reservation not found';
  end if;

  v_new_balance := public._refund_credit_reservation_row(v_reservation);

  return jsonb_build_object('creditBalance', v_new_balance);
end;
$$;

create or replace function public.reserve_regenerate_question_credit(
  p_worksheet_id uuid,
  p_question_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current_balance integer;
  v_new_balance integer;
  v_existing_order integer;
  v_locked_worksheet_id uuid;
  v_reservation_id uuid;
  v_credit_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_question_id is null or length(trim(p_question_id)) = 0 then
    raise exception 'Invalid question id';
  end if;

  select id, credit_balance
  into v_profile_id, v_current_balance
  from public.profiles
  where auth_user_id = auth.uid()
  for update;

  if v_profile_id is null then
    raise exception 'Profile not found';
  end if;

  perform public._cleanup_expired_reservations_for_user(v_profile_id);

  if v_current_balance < 1 then
    raise exception 'Insufficient credits';
  end if;

  select w.id
  into v_locked_worksheet_id
  from public.worksheets w
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
  for update;

  if v_locked_worksheet_id is null then
    raise exception 'Worksheet not found';
  end if;

  select (q->>'order')::integer
  into v_existing_order
  from public.worksheets w
  cross join jsonb_array_elements(w.questions) as q
  where w.id = p_worksheet_id
    and w.user_id = v_profile_id
    and q->>'id' = p_question_id;

  if v_existing_order is null then
    raise exception 'Worksheet or question not found';
  end if;

  if exists (
    select 1
    from public.credit_reservations cr
    where cr.worksheet_id = p_worksheet_id
      and cr.kind = 'regenerate_question'
      and cr.question_id = p_question_id
  ) then
    raise exception 'Slot already reserved';
  end if;

  v_new_balance := v_current_balance - 1;

  update public.profiles
  set credit_balance = v_new_balance,
      updated_at = now()
  where id = v_profile_id;

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
    -1,
    v_new_balance,
    p_worksheet_id,
    p_question_id
  )
  returning id into v_credit_transaction_id;

  insert into public.credit_reservations (
    user_id,
    worksheet_id,
    kind,
    question_id,
    credit_transaction_id
  )
  values (
    v_profile_id,
    p_worksheet_id,
    'regenerate_question',
    p_question_id,
    v_credit_transaction_id
  )
  returning id into v_reservation_id;

  return jsonb_build_object(
    'reservationId', v_reservation_id,
    'creditBalance', v_new_balance
  );
end;
$$;

create or replace function public.complete_regenerate_question_reservation(
  p_reservation_id uuid,
  p_new_question jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.credit_reservations;
  v_profile_id uuid;
  v_credit_balance integer;
  v_existing_order integer;
  v_updated_question jsonb;
  v_rows_updated integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_valid_worksheet_question(p_new_question) then
    raise exception 'Invalid worksheet question';
  end if;

  select id
  into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    raise exception 'Profile not found';
  end if;

  select *
  into v_reservation
  from public.credit_reservations
  where id = p_reservation_id
    and user_id = v_profile_id
  for update;

  if not found then
    raise exception 'Reservation not found';
  end if;

  if v_reservation.expires_at < now() then
    raise exception 'Reservation expired';
  end if;

  if v_reservation.kind <> 'regenerate_question' then
    raise exception 'Reservation not found';
  end if;

  if p_new_question->>'id' <> v_reservation.question_id then
    raise exception 'Question id cannot be changed';
  end if;

  select (q->>'order')::integer
  into v_existing_order
  from public.worksheets w
  cross join jsonb_array_elements(w.questions) as q
  where w.id = v_reservation.worksheet_id
    and w.user_id = v_profile_id
    and q->>'id' = v_reservation.question_id;

  if v_existing_order is null then
    raise exception 'Worksheet or question not found';
  end if;

  if (p_new_question->>'order')::integer <> v_existing_order then
    raise exception 'Question order cannot be changed';
  end if;

  update public.worksheets
  set questions = (
    select jsonb_agg(
      case
        when q->>'id' = v_reservation.question_id then p_new_question
        else q
      end
      order by (q->>'order')::integer
    )
    from jsonb_array_elements(questions) as q
  ),
  updated_at = now()
  where id = v_reservation.worksheet_id
    and user_id = v_profile_id
    and (p_new_question->>'order')::integer <= question_count
  returning p_new_question into v_updated_question;

  get diagnostics v_rows_updated = row_count;

  if v_rows_updated = 0 or v_updated_question is null then
    raise exception 'Worksheet or question not found';
  end if;

  delete from public.credit_reservations
  where id = v_reservation.id;

  select credit_balance
  into v_credit_balance
  from public.profiles
  where id = v_profile_id;

  return jsonb_build_object(
    'question', v_updated_question,
    'creditBalance', v_credit_balance
  );
end;
$$;

create or replace function public.cancel_regenerate_question_reservation(
  p_reservation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.credit_reservations;
  v_profile_id uuid;
  v_new_balance integer;
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

  select *
  into v_reservation
  from public.credit_reservations
  where id = p_reservation_id
    and user_id = v_profile_id
  for update;

  if not found then
    raise exception 'Reservation not found';
  end if;

  if v_reservation.kind <> 'regenerate_question' then
    raise exception 'Reservation not found';
  end if;

  v_new_balance := public._refund_credit_reservation_row(v_reservation);

  return jsonb_build_object('creditBalance', v_new_balance);
end;
$$;

revoke all on function public.reserve_generate_question_credit(uuid, integer) from public;
revoke all on function public.complete_generate_question_reservation(uuid, jsonb) from public;
revoke all on function public.cancel_generate_question_reservation(uuid) from public;
revoke all on function public.reserve_regenerate_question_credit(uuid, text) from public;
revoke all on function public.complete_regenerate_question_reservation(uuid, jsonb) from public;
revoke all on function public.cancel_regenerate_question_reservation(uuid) from public;

grant execute on function public.reserve_generate_question_credit(uuid, integer) to authenticated;
grant execute on function public.complete_generate_question_reservation(uuid, jsonb) to authenticated;
grant execute on function public.cancel_generate_question_reservation(uuid) to authenticated;
grant execute on function public.reserve_regenerate_question_credit(uuid, text) to authenticated;
grant execute on function public.complete_regenerate_question_reservation(uuid, jsonb) to authenticated;
grant execute on function public.cancel_regenerate_question_reservation(uuid) to authenticated;

create or replace function public.append_worksheet_question(
  p_worksheet_id uuid,
  p_question jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Use reserve/complete reservation RPCs';
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
begin
  raise exception 'Use reserve/complete reservation RPCs';
end;
$$;

-- Schedule expired-reservation cleanup when pg_cron is available (hosted Supabase).
-- Fallback: deploy a scheduled Edge Function calling cleanup_expired_credit_reservations().
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'cleanup-expired-credit-reservations';

    perform cron.schedule(
      'cleanup-expired-credit-reservations',
      '*/5 * * * *',
      $cron$ select public.cleanup_expired_credit_reservations(); $cron$
    );
  end if;
exception
  when undefined_table or undefined_function then
    null;
  when others then
    raise notice 'pg_cron schedule skipped: %', sqlerrm;
end;
$$;

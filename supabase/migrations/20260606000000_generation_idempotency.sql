-- P2: idempotency keys for generate (append) and regenerate reservation flows.

create table if not exists public.generation_idempotency (
  user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null,
  kind text not null check (kind in ('generate_question', 'regenerate_question')),
  worksheet_id uuid not null references public.worksheets(id) on delete cascade,
  status text not null check (status in ('reserved', 'completed', 'failed')),
  reservation_id uuid references public.credit_reservations(id) on delete set null,
  pending_question_id uuid,
  completed_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (user_id, idempotency_key)
);

create index if not exists generation_idempotency_expires_at_idx
  on public.generation_idempotency (expires_at);

create index if not exists generation_idempotency_reservation_id_idx
  on public.generation_idempotency (reservation_id)
  where reservation_id is not null;

alter table public.generation_idempotency enable row level security;

create or replace function public._validate_idempotency_key(p_idempotency_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'Idempotency key required';
  end if;

  if length(p_idempotency_key) > 200 then
    raise exception 'Idempotency key too long';
  end if;

  if p_idempotency_key !~ '^(gen|regen):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:.+$' then
    raise exception 'Invalid idempotency key';
  end if;
end;
$$;

revoke all on function public._validate_idempotency_key(text) from public;

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
  delete from public.generation_idempotency
  where user_id = p_user_id
    and expires_at < now();

  for v_reservation in
    select *
    from public.credit_reservations
    where user_id = p_user_id
      and expires_at < now()
    for update
  loop
    perform public._refund_credit_reservation_row(v_reservation);
  end loop;

  delete from public.generation_idempotency
  where user_id = p_user_id
    and status = 'reserved'
    and reservation_id is not null
    and not exists (
      select 1
      from public.credit_reservations cr
      where cr.id = generation_idempotency.reservation_id
    );
end;
$$;

create or replace function public._delete_idempotency_for_reservation(
  p_reservation_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.generation_idempotency
  where reservation_id = p_reservation_id;
end;
$$;

revoke all on function public._delete_idempotency_for_reservation(uuid) from public;

create or replace function public._try_reconcile_completed_generate_idempotency(
  p_idempotency public.generation_idempotency,
  p_profile_id uuid,
  p_worksheet_id uuid,
  p_order integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_question jsonb;
  v_credit_balance integer;
  v_result jsonb;
begin
  select q
  into v_existing_question
  from public.worksheets w
  cross join jsonb_array_elements(w.questions) as q
  where w.id = p_worksheet_id
    and w.user_id = p_profile_id
    and (
      (q->>'order')::integer = p_order
      or (
        p_idempotency.pending_question_id is not null
        and q->>'id' = p_idempotency.pending_question_id::text
      )
    )
  limit 1;

  if v_existing_question is null then
    return null;
  end if;

  select credit_balance
  into v_credit_balance
  from public.profiles
  where id = p_profile_id;

  v_result := jsonb_build_object(
    'success', true,
    'question', v_existing_question,
    'creditBalance', v_credit_balance
  );

  update public.generation_idempotency
  set status = 'completed',
      completed_result = v_result,
      reservation_id = null,
      updated_at = now()
  where user_id = p_idempotency.user_id
    and idempotency_key = p_idempotency.idempotency_key;

  return v_result || jsonb_build_object('alreadyCompleted', true);
end;
$$;

revoke all on function public._try_reconcile_completed_generate_idempotency(public.generation_idempotency, uuid, uuid, integer) from public;

create or replace function public._try_reconcile_completed_regenerate_idempotency(
  p_idempotency public.generation_idempotency,
  p_profile_id uuid,
  p_worksheet_id uuid,
  p_question_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_question jsonb;
  v_credit_balance integer;
  v_result jsonb;
begin
  select q
  into v_existing_question
  from public.worksheets w
  cross join jsonb_array_elements(w.questions) as q
  where w.id = p_worksheet_id
    and w.user_id = p_profile_id
    and q->>'id' = p_question_id
  limit 1;

  if v_existing_question is null then
    return null;
  end if;

  select credit_balance
  into v_credit_balance
  from public.profiles
  where id = p_profile_id;

  v_result := jsonb_build_object(
    'success', true,
    'question', v_existing_question,
    'creditBalance', v_credit_balance
  );

  update public.generation_idempotency
  set status = 'completed',
      completed_result = v_result,
      reservation_id = null,
      updated_at = now()
  where user_id = p_idempotency.user_id
    and idempotency_key = p_idempotency.idempotency_key;

  return v_result || jsonb_build_object('alreadyCompleted', true);
end;
$$;

revoke all on function public._try_reconcile_completed_regenerate_idempotency(public.generation_idempotency, uuid, uuid, text) from public;

-- Drop old RPC signatures before recreating with idempotency key parameter.
drop function if exists public.reserve_generate_question_credit(uuid, integer);
drop function if exists public.complete_generate_question_reservation(uuid, jsonb);
drop function if exists public.cancel_generate_question_reservation(uuid);
drop function if exists public.reserve_regenerate_question_credit(uuid, text);
drop function if exists public.complete_regenerate_question_reservation(uuid, jsonb);
drop function if exists public.cancel_regenerate_question_reservation(uuid);

create or replace function public.reserve_generate_question_credit(
  p_worksheet_id uuid,
  p_order integer,
  p_idempotency_key text
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
  v_pending_question_id uuid;
  v_idempotency public.generation_idempotency;
  v_reconciled jsonb;
begin
  perform public._validate_idempotency_key(p_idempotency_key);

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

  select *
  into v_idempotency
  from public.generation_idempotency
  where user_id = v_profile_id
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_idempotency.status = 'completed' then
      return v_idempotency.completed_result || jsonb_build_object('alreadyCompleted', true);
    end if;

    if v_idempotency.status = 'reserved' then
      if exists (
        select 1
        from public.credit_reservations cr
        where cr.id = v_idempotency.reservation_id
      ) then
        select credit_balance
        into v_current_balance
        from public.profiles
        where id = v_profile_id;

        return jsonb_build_object(
          'reservationId', v_idempotency.reservation_id,
          'creditBalance', v_current_balance,
          'pendingQuestionId', v_idempotency.pending_question_id,
          'alreadyCompleted', false
        );
      end if;

      v_reconciled := public._try_reconcile_completed_generate_idempotency(
        v_idempotency,
        v_profile_id,
        p_worksheet_id,
        p_order
      );

      if v_reconciled is not null then
        return v_reconciled;
      end if;

      delete from public.generation_idempotency
      where user_id = v_profile_id
        and idempotency_key = p_idempotency_key;
    elsif v_idempotency.status = 'failed' then
      delete from public.generation_idempotency
      where user_id = v_profile_id
        and idempotency_key = p_idempotency_key;
    end if;
  end if;

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
  v_pending_question_id := gen_random_uuid();

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

  insert into public.generation_idempotency (
    user_id,
    idempotency_key,
    kind,
    worksheet_id,
    status,
    reservation_id,
    pending_question_id,
    expires_at
  )
  values (
    v_profile_id,
    p_idempotency_key,
    'generate_question',
    p_worksheet_id,
    'reserved',
    v_reservation_id,
    v_pending_question_id,
    now() + interval '24 hours'
  );

  return jsonb_build_object(
    'reservationId', v_reservation_id,
    'creditBalance', v_new_balance,
    'pendingQuestionId', v_pending_question_id,
    'alreadyCompleted', false
  );
end;
$$;

create or replace function public.complete_generate_question_reservation(
  p_reservation_id uuid,
  p_question jsonb,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.credit_reservations;
  v_profile_id uuid;
  v_credit_balance integer;
  v_locked_worksheet_id uuid;
  v_updated_question jsonb;
  v_existing_question jsonb;
  v_rows_updated integer;
  v_idempotency public.generation_idempotency;
  v_result jsonb;
begin
  perform public._validate_idempotency_key(p_idempotency_key);

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
  into v_idempotency
  from public.generation_idempotency
  where user_id = v_profile_id
    and idempotency_key = p_idempotency_key
  for update;

  if found and v_idempotency.status = 'completed' then
    return v_idempotency.completed_result;
  end if;

  if found
    and v_idempotency.pending_question_id is not null
    and p_question->>'id' <> v_idempotency.pending_question_id::text then
    raise exception 'Question id does not match reservation';
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

  select w.id
  into v_locked_worksheet_id
  from public.worksheets w
  where w.id = v_reservation.worksheet_id
    and w.user_id = v_profile_id
  for update;

  if v_locked_worksheet_id is null then
    v_credit_balance := public._refund_credit_reservation_row(v_reservation);

    delete from public.generation_idempotency
    where user_id = v_profile_id
      and idempotency_key = p_idempotency_key;

    return jsonb_build_object(
      'success', false,
      'creditBalance', v_credit_balance,
      'message', 'Worksheet not found or already complete'
    );
  end if;

  select q
  into v_existing_question
  from public.worksheets w
  cross join jsonb_array_elements(w.questions) as q
  where w.id = v_reservation.worksheet_id
    and w.user_id = v_profile_id
    and (
      q->>'id' = p_question->>'id'
      or (q->>'order')::integer = v_reservation.question_order
    )
  limit 1;

  if v_existing_question is not null then
    delete from public.credit_reservations
    where id = v_reservation.id;

    select credit_balance
    into v_credit_balance
    from public.profiles
    where id = v_profile_id;

    v_result := jsonb_build_object(
      'success', true,
      'question', v_existing_question,
      'creditBalance', v_credit_balance
    );

    insert into public.generation_idempotency (
      user_id,
      idempotency_key,
      kind,
      worksheet_id,
      status,
      completed_result,
      pending_question_id,
      expires_at
    )
    values (
      v_profile_id,
      p_idempotency_key,
      'generate_question',
      v_reservation.worksheet_id,
      'completed',
      v_result,
      (p_question->>'id')::uuid,
      now() + interval '24 hours'
    )
    on conflict (user_id, idempotency_key) do update
      set status = 'completed',
          completed_result = excluded.completed_result,
          reservation_id = null,
          updated_at = now();

    return v_result;
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
    v_credit_balance := public._refund_credit_reservation_row(v_reservation);

    delete from public.generation_idempotency
    where user_id = v_profile_id
      and idempotency_key = p_idempotency_key;

    return jsonb_build_object(
      'success', false,
      'creditBalance', v_credit_balance,
      'message', 'Worksheet not found or already complete'
    );
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

  v_result := jsonb_build_object(
    'success', true,
    'question', v_updated_question,
    'creditBalance', v_credit_balance
  );

  insert into public.generation_idempotency (
    user_id,
    idempotency_key,
    kind,
    worksheet_id,
    status,
    completed_result,
    pending_question_id,
    expires_at
  )
  values (
    v_profile_id,
    p_idempotency_key,
    'generate_question',
    v_reservation.worksheet_id,
    'completed',
    v_result,
    (p_question->>'id')::uuid,
    now() + interval '24 hours'
  )
  on conflict (user_id, idempotency_key) do update
    set status = 'completed',
        completed_result = excluded.completed_result,
        reservation_id = null,
        updated_at = now();

  return v_result;
end;
$$;

create or replace function public.cancel_generate_question_reservation(
  p_reservation_id uuid,
  p_idempotency_key text
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
  perform public._validate_idempotency_key(p_idempotency_key);

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

  delete from public.generation_idempotency
  where user_id = v_profile_id
    and idempotency_key = p_idempotency_key;

  return jsonb_build_object('creditBalance', v_new_balance);
end;
$$;

create or replace function public.reserve_regenerate_question_credit(
  p_worksheet_id uuid,
  p_question_id text,
  p_idempotency_key text
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
  v_idempotency public.generation_idempotency;
  v_reconciled jsonb;
begin
  perform public._validate_idempotency_key(p_idempotency_key);

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

  select *
  into v_idempotency
  from public.generation_idempotency
  where user_id = v_profile_id
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_idempotency.status = 'completed' then
      return v_idempotency.completed_result || jsonb_build_object('alreadyCompleted', true);
    end if;

    if v_idempotency.status = 'reserved' then
      if exists (
        select 1
        from public.credit_reservations cr
        where cr.id = v_idempotency.reservation_id
      ) then
        select credit_balance
        into v_current_balance
        from public.profiles
        where id = v_profile_id;

        return jsonb_build_object(
          'reservationId', v_idempotency.reservation_id,
          'creditBalance', v_current_balance,
          'alreadyCompleted', false
        );
      end if;

      v_reconciled := public._try_reconcile_completed_regenerate_idempotency(
        v_idempotency,
        v_profile_id,
        p_worksheet_id,
        p_question_id
      );

      if v_reconciled is not null then
        return v_reconciled;
      end if;

      delete from public.generation_idempotency
      where user_id = v_profile_id
        and idempotency_key = p_idempotency_key;
    elsif v_idempotency.status = 'failed' then
      delete from public.generation_idempotency
      where user_id = v_profile_id
        and idempotency_key = p_idempotency_key;
    end if;
  end if;

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

  insert into public.generation_idempotency (
    user_id,
    idempotency_key,
    kind,
    worksheet_id,
    status,
    reservation_id,
    expires_at
  )
  values (
    v_profile_id,
    p_idempotency_key,
    'regenerate_question',
    p_worksheet_id,
    'reserved',
    v_reservation_id,
    now() + interval '24 hours'
  );

  return jsonb_build_object(
    'reservationId', v_reservation_id,
    'creditBalance', v_new_balance,
    'alreadyCompleted', false
  );
end;
$$;

create or replace function public.complete_regenerate_question_reservation(
  p_reservation_id uuid,
  p_new_question jsonb,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.credit_reservations;
  v_profile_id uuid;
  v_credit_balance integer;
  v_locked_worksheet_id uuid;
  v_existing_order integer;
  v_updated_question jsonb;
  v_rows_updated integer;
  v_idempotency public.generation_idempotency;
  v_result jsonb;
begin
  perform public._validate_idempotency_key(p_idempotency_key);

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
  into v_idempotency
  from public.generation_idempotency
  where user_id = v_profile_id
    and idempotency_key = p_idempotency_key
  for update;

  if found and v_idempotency.status = 'completed' then
    return v_idempotency.completed_result;
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

  select w.id
  into v_locked_worksheet_id
  from public.worksheets w
  where w.id = v_reservation.worksheet_id
    and w.user_id = v_profile_id
  for update;

  if v_locked_worksheet_id is null then
    v_credit_balance := public._refund_credit_reservation_row(v_reservation);

    delete from public.generation_idempotency
    where user_id = v_profile_id
      and idempotency_key = p_idempotency_key;

    return jsonb_build_object(
      'success', false,
      'creditBalance', v_credit_balance,
      'message', 'Worksheet or question not found'
    );
  end if;

  select (q->>'order')::integer
  into v_existing_order
  from public.worksheets w
  cross join jsonb_array_elements(w.questions) as q
  where w.id = v_reservation.worksheet_id
    and w.user_id = v_profile_id
    and q->>'id' = v_reservation.question_id;

  if v_existing_order is null then
    v_credit_balance := public._refund_credit_reservation_row(v_reservation);

    delete from public.generation_idempotency
    where user_id = v_profile_id
      and idempotency_key = p_idempotency_key;

    return jsonb_build_object(
      'success', false,
      'creditBalance', v_credit_balance,
      'message', 'Worksheet or question not found'
    );
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
    v_credit_balance := public._refund_credit_reservation_row(v_reservation);

    delete from public.generation_idempotency
    where user_id = v_profile_id
      and idempotency_key = p_idempotency_key;

    return jsonb_build_object(
      'success', false,
      'creditBalance', v_credit_balance,
      'message', 'Worksheet or question not found'
    );
  end if;

  delete from public.credit_reservations
  where id = v_reservation.id;

  select credit_balance
  into v_credit_balance
  from public.profiles
  where id = v_profile_id;

  v_result := jsonb_build_object(
    'success', true,
    'question', v_updated_question,
    'creditBalance', v_credit_balance
  );

  insert into public.generation_idempotency (
    user_id,
    idempotency_key,
    kind,
    worksheet_id,
    status,
    completed_result,
    expires_at
  )
  values (
    v_profile_id,
    p_idempotency_key,
    'regenerate_question',
    v_reservation.worksheet_id,
    'completed',
    v_result,
    now() + interval '24 hours'
  )
  on conflict (user_id, idempotency_key) do update
    set status = 'completed',
        completed_result = excluded.completed_result,
        reservation_id = null,
        updated_at = now();

  return v_result;
end;
$$;

create or replace function public.cancel_regenerate_question_reservation(
  p_reservation_id uuid,
  p_idempotency_key text
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
  perform public._validate_idempotency_key(p_idempotency_key);

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

  delete from public.generation_idempotency
  where user_id = v_profile_id
    and idempotency_key = p_idempotency_key;

  return jsonb_build_object('creditBalance', v_new_balance);
end;
$$;

revoke all on function public.reserve_generate_question_credit(uuid, integer, text) from public;
revoke all on function public.complete_generate_question_reservation(uuid, jsonb, text) from public;
revoke all on function public.cancel_generate_question_reservation(uuid, text) from public;
revoke all on function public.reserve_regenerate_question_credit(uuid, text, text) from public;
revoke all on function public.complete_regenerate_question_reservation(uuid, jsonb, text) from public;
revoke all on function public.cancel_regenerate_question_reservation(uuid, text) from public;

grant execute on function public.reserve_generate_question_credit(uuid, integer, text) to authenticated;
grant execute on function public.complete_generate_question_reservation(uuid, jsonb, text) to authenticated;
grant execute on function public.cancel_generate_question_reservation(uuid, text) to authenticated;
grant execute on function public.reserve_regenerate_question_credit(uuid, text, text) to authenticated;
grant execute on function public.complete_regenerate_question_reservation(uuid, jsonb, text) to authenticated;
grant execute on function public.cancel_regenerate_question_reservation(uuid, text) to authenticated;

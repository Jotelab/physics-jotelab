-- Harden complete reservation RPCs: lock worksheet rows and auto-refund on 0-row updates.

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
  v_locked_worksheet_id uuid;
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

  select w.id
  into v_locked_worksheet_id
  from public.worksheets w
  where w.id = v_reservation.worksheet_id
    and w.user_id = v_profile_id
  for update;

  if v_locked_worksheet_id is null then
    v_credit_balance := public._refund_credit_reservation_row(v_reservation);

    return jsonb_build_object(
      'success', false,
      'creditBalance', v_credit_balance,
      'message', 'Worksheet not found or already complete'
    );
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

  return jsonb_build_object(
    'success', true,
    'question', v_updated_question,
    'creditBalance', v_credit_balance
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
  v_locked_worksheet_id uuid;
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

  select w.id
  into v_locked_worksheet_id
  from public.worksheets w
  where w.id = v_reservation.worksheet_id
    and w.user_id = v_profile_id
  for update;

  if v_locked_worksheet_id is null then
    v_credit_balance := public._refund_credit_reservation_row(v_reservation);

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

  return jsonb_build_object(
    'success', true,
    'question', v_updated_question,
    'creditBalance', v_credit_balance
  );
end;
$$;

revoke all on function public.complete_generate_question_reservation(uuid, jsonb) from public;
revoke all on function public.complete_regenerate_question_reservation(uuid, jsonb) from public;

grant execute on function public.complete_generate_question_reservation(uuid, jsonb) to authenticated;
grant execute on function public.complete_regenerate_question_reservation(uuid, jsonb) to authenticated;

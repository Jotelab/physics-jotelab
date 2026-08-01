-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260615000000_worksheet_variants.sql
-- Redefined 2x across: 20260601000000_credit_reservations.sql, 20260615000000_worksheet_variants.sql

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
  elsif p_reservation.kind = 'variant_roll' then
    v_refund_type := 'variant_roll_refund';
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

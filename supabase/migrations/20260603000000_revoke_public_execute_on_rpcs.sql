-- Explicitly revoke default PUBLIC/anon EXECUTE on all RPCs; grant only intended roles.

-- User-facing RPCs (authenticated only)
revoke all on function public.ensure_user_profile() from public;
revoke all on function public.ensure_user_profile() from anon;
grant execute on function public.ensure_user_profile() to authenticated;

revoke all on function public.generate_worksheet_init(text, text, integer, jsonb) from public;
revoke all on function public.generate_worksheet_init(text, text, integer, jsonb) from anon;
grant execute on function public.generate_worksheet_init(text, text, integer, jsonb) to authenticated;

revoke all on function public.replace_worksheet_question(uuid, text, jsonb) from public;
revoke all on function public.replace_worksheet_question(uuid, text, jsonb) from anon;
grant execute on function public.replace_worksheet_question(uuid, text, jsonb) to authenticated;

revoke all on function public.extend_worksheet_count(uuid, integer) from public;
revoke all on function public.extend_worksheet_count(uuid, integer) from anon;
grant execute on function public.extend_worksheet_count(uuid, integer) to authenticated;

revoke all on function public.append_worksheet_question(uuid, jsonb) from public;
revoke all on function public.append_worksheet_question(uuid, jsonb) from anon;
grant execute on function public.append_worksheet_question(uuid, jsonb) to authenticated;

revoke all on function public.regenerate_question_replace_and_deduct(uuid, text, jsonb) from public;
revoke all on function public.regenerate_question_replace_and_deduct(uuid, text, jsonb) from anon;
grant execute on function public.regenerate_question_replace_and_deduct(uuid, text, jsonb) to authenticated;

revoke all on function public.reserve_generate_question_credit(uuid, integer) from public;
revoke all on function public.reserve_generate_question_credit(uuid, integer) from anon;
grant execute on function public.reserve_generate_question_credit(uuid, integer) to authenticated;

revoke all on function public.complete_generate_question_reservation(uuid, jsonb) from public;
revoke all on function public.complete_generate_question_reservation(uuid, jsonb) from anon;
grant execute on function public.complete_generate_question_reservation(uuid, jsonb) to authenticated;

revoke all on function public.cancel_generate_question_reservation(uuid) from public;
revoke all on function public.cancel_generate_question_reservation(uuid) from anon;
grant execute on function public.cancel_generate_question_reservation(uuid) to authenticated;

revoke all on function public.reserve_regenerate_question_credit(uuid, text) from public;
revoke all on function public.reserve_regenerate_question_credit(uuid, text) from anon;
grant execute on function public.reserve_regenerate_question_credit(uuid, text) to authenticated;

revoke all on function public.complete_regenerate_question_reservation(uuid, jsonb) from public;
revoke all on function public.complete_regenerate_question_reservation(uuid, jsonb) from anon;
grant execute on function public.complete_regenerate_question_reservation(uuid, jsonb) to authenticated;

revoke all on function public.cancel_regenerate_question_reservation(uuid) from public;
revoke all on function public.cancel_regenerate_question_reservation(uuid) from anon;
grant execute on function public.cancel_regenerate_question_reservation(uuid) to authenticated;

-- Internal helpers (no client access)
revoke all on function public._refund_credit_reservation_row(public.credit_reservations) from public;
revoke all on function public._refund_credit_reservation_row(public.credit_reservations) from anon;
revoke all on function public._refund_credit_reservation_row(public.credit_reservations) from authenticated;

revoke all on function public._cleanup_expired_reservations_for_user(uuid) from public;
revoke all on function public._cleanup_expired_reservations_for_user(uuid) from anon;
revoke all on function public._cleanup_expired_reservations_for_user(uuid) from authenticated;

-- Cron-only cleanup RPC
revoke all on function public.cleanup_expired_credit_reservations() from public;
revoke all on function public.cleanup_expired_credit_reservations() from anon;
revoke all on function public.cleanup_expired_credit_reservations() from authenticated;
grant execute on function public.cleanup_expired_credit_reservations() to service_role;

-- Validation helpers (CHECK constraints only; not callable via API)
revoke all on function public.is_valid_generation_settings(jsonb) from public;
revoke all on function public.is_valid_generation_settings(jsonb) from anon;
revoke all on function public.is_valid_generation_settings(jsonb) from authenticated;

revoke all on function public.is_valid_worksheet_question(jsonb) from public;
revoke all on function public.is_valid_worksheet_question(jsonb) from anon;
revoke all on function public.is_valid_worksheet_question(jsonb) from authenticated;

revoke all on function public.is_valid_worksheet_questions_array(jsonb, integer) from public;
revoke all on function public.is_valid_worksheet_questions_array(jsonb, integer) from anon;
revoke all on function public.is_valid_worksheet_questions_array(jsonb, integer) from authenticated;

revoke all on function public.is_valid_generation_settings_variable(jsonb) from public;
revoke all on function public.is_valid_generation_settings_variable(jsonb) from anon;
revoke all on function public.is_valid_generation_settings_variable(jsonb) from authenticated;

revoke all on function public.is_valid_generation_settings_target_variable(jsonb) from public;
revoke all on function public.is_valid_generation_settings_target_variable(jsonb) from anon;
revoke all on function public.is_valid_generation_settings_target_variable(jsonb) from authenticated;

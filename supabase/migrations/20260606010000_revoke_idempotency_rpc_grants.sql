-- Explicit grants for idempotency-aware reservation RPC signatures.

revoke all on function public.reserve_generate_question_credit(uuid, integer, text) from public;
revoke all on function public.reserve_generate_question_credit(uuid, integer, text) from anon;
grant execute on function public.reserve_generate_question_credit(uuid, integer, text) to authenticated;

revoke all on function public.complete_generate_question_reservation(uuid, jsonb, text) from public;
revoke all on function public.complete_generate_question_reservation(uuid, jsonb, text) from anon;
grant execute on function public.complete_generate_question_reservation(uuid, jsonb, text) to authenticated;

revoke all on function public.cancel_generate_question_reservation(uuid, text) from public;
revoke all on function public.cancel_generate_question_reservation(uuid, text) from anon;
grant execute on function public.cancel_generate_question_reservation(uuid, text) to authenticated;

revoke all on function public.reserve_regenerate_question_credit(uuid, text, text) from public;
revoke all on function public.reserve_regenerate_question_credit(uuid, text, text) from anon;
grant execute on function public.reserve_regenerate_question_credit(uuid, text, text) to authenticated;

revoke all on function public.complete_regenerate_question_reservation(uuid, jsonb, text) from public;
revoke all on function public.complete_regenerate_question_reservation(uuid, jsonb, text) from anon;
grant execute on function public.complete_regenerate_question_reservation(uuid, jsonb, text) to authenticated;

revoke all on function public.cancel_regenerate_question_reservation(uuid, text) from public;
revoke all on function public.cancel_regenerate_question_reservation(uuid, text) from anon;
grant execute on function public.cancel_regenerate_question_reservation(uuid, text) to authenticated;

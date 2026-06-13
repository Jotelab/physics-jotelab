-- P1: composite indexes for RLS-scoped, recency-ordered reads.
-- worksheets_user_created_idx already exists in 20260604000000; IF NOT EXISTS is safe if re-run.

create index if not exists worksheets_user_created_idx
  on public.worksheets (user_id, created_at desc);

create index if not exists credit_transactions_user_created_idx
  on public.credit_transactions (user_id, created_at desc);

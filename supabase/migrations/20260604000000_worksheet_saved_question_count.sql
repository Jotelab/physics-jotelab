-- Library list optimization: expose saved question count without fetching questions JSONB.

alter table public.worksheets
  add column if not exists saved_question_count integer
  generated always as (jsonb_array_length(questions)) stored;

create index if not exists worksheets_user_created_idx
  on public.worksheets (user_id, created_at desc);

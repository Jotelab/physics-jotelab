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

create or replace function public.is_valid_worksheet_variant(p_variant jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_roll jsonb;
begin
  if jsonb_typeof(p_variant) is distinct from 'object' then
    return false;
  end if;

  if not (
    p_variant ? 'id'
    and p_variant ? 'label'
    and p_variant ? 'createdAt'
    and p_variant ? 'rolls'
  ) then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_variant) as key
    where key not in ('id', 'label', 'createdAt', 'rolls')
  ) then
    return false;
  end if;

  if jsonb_typeof(p_variant->'id') is distinct from 'string'
    or (p_variant->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return false;
  end if;

  if jsonb_typeof(p_variant->'label') is distinct from 'string'
    or p_variant->>'label' not in ('B', 'C', 'D')
  then
    return false;
  end if;

  if jsonb_typeof(p_variant->'createdAt') is distinct from 'string'
    or length(p_variant->>'createdAt') = 0
  then
    return false;
  end if;

  if jsonb_typeof(p_variant->'rolls') is distinct from 'array'
    or jsonb_array_length(p_variant->'rolls') = 0
    or jsonb_array_length(p_variant->'rolls') > public.max_worksheet_question_count()
  then
    return false;
  end if;

  for v_roll in
    select value from jsonb_array_elements(p_variant->'rolls')
  loop
    if not public.is_valid_variant_question_roll(v_roll) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

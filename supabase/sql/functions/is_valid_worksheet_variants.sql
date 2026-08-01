-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260707000000_variant_roll_sympy_data.sql
-- Redefined 2x across: 20260615000000_worksheet_variants.sql, 20260707000000_variant_roll_sympy_data.sql

create or replace function public.is_valid_worksheet_variants(p_variants jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_variant jsonb;
  v_label text;
begin
  if jsonb_typeof(p_variants) is distinct from 'object' then
    return false;
  end if;

  if not (p_variants ? 'saved') then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_variants) as key
    where key <> 'saved'
  ) then
    return false;
  end if;

  if jsonb_typeof(p_variants->'saved') is distinct from 'array'
    or jsonb_array_length(p_variants->'saved') > 3
  then
    return false;
  end if;

  if octet_length(p_variants::text) > 262144 then
    return false;
  end if;

  for v_variant in
    select value from jsonb_array_elements(p_variants->'saved')
  loop
    if not public.is_valid_worksheet_variant(v_variant) then
      return false;
    end if;
  end loop;

  for v_label in
    select v->>'label'
    from jsonb_array_elements(p_variants->'saved') as v
  loop
    if (
      select count(*)
      from jsonb_array_elements(p_variants->'saved') as v2
      where v2->>'label' = v_label
    ) > 1 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

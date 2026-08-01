-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- `pnpm run db:functions:sync`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. `pnpm run db:functions:check` fails if the two drift.
-- Last changed by: 20260607000000_payload_size_limits.sql
-- Redefined 2x across: 20260524000000_phase_8_generation_settings_variables.sql, 20260607000000_payload_size_limits.sql

create or replace function public.is_valid_generation_settings_target_variable(
  p_variable jsonb
) returns boolean
language plpgsql
immutable
set search_path = public
as $$
begin
  if jsonb_typeof(p_variable) is distinct from 'object' then
    return false;
  end if;

  if not (p_variable ? 'symbol' and p_variable ? 'label') then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_variable) as key
    where key not in ('symbol', 'label', 'unit')
  ) then
    return false;
  end if;

  if not public._jsonb_string_len_ok(p_variable->'symbol', 32)
    or not public._jsonb_string_len_ok(p_variable->'label', 120)
  then
    return false;
  end if;

  if p_variable ? 'unit' then
    if jsonb_typeof(p_variable->'unit') is distinct from 'string'
      or length(p_variable->>'unit') = 0
      or length(p_variable->>'unit') > 32
    then
      return false;
    end if;
  end if;

  return true;
end;
$$;

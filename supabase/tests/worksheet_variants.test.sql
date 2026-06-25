-- pgTAP tests for worksheet variants payload validation and save RPC.

begin;
select plan(4);

select has_function('public', 'is_valid_worksheet_variants', array['jsonb']);
select has_function('public', 'save_worksheet_variants', array['uuid', 'jsonb']);

select ok(
  public.is_valid_worksheet_variants('{"saved":[]}'::jsonb),
  'empty saved variants payload is valid'
);

select ok(
  not public.is_valid_worksheet_variants('{"saved":[{"id":"not-a-uuid","label":"B","createdAt":"x","rolls":[]}]}'::jsonb),
  'invalid variant payload is rejected'
);

select * from finish();
rollback;

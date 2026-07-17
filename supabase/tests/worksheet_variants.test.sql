-- pgTAP tests for worksheet variants payload validation and save RPC.

begin;
select plan(7);

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

-- Engine-backed rolls carry the verified engine payload verbatim
-- (20260707000000_variant_roll_sympy_data.sql).
select ok(
  public.is_valid_variant_question_roll(
    '{"order":1,
      "given_values":[{"symbol":"a","label":"acceleration","value":2}],
      "solution":{"steps":["step"],"final_answer":"x"},
      "sympy_data":{"topic":"suvat","seed":1}}'::jsonb
  ),
  'roll with sympy_data object is valid'
);

select ok(
  not public.is_valid_variant_question_roll(
    '{"order":1,
      "given_values":[{"symbol":"a","label":"acceleration","value":2}],
      "solution":{"steps":["step"],"final_answer":"x"},
      "sympy_data":"not-an-object"}'::jsonb
  ),
  'roll with non-object sympy_data is rejected'
);

select ok(
  not public.is_valid_variant_question_roll(
    '{"order":1,
      "given_values":[{"symbol":"a","label":"acceleration","value":2}],
      "solution":{"steps":["step"],"final_answer":"x"},
      "diagram_svg":"<svg/>"}'::jsonb
  ),
  'roll with a key outside the allowlist is rejected'
);

select * from finish();
rollback;

-- pgTAP tests for worksheet JSON payload size limits.
-- Run with: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

do $$
declare
  v_valid_question jsonb := jsonb_build_object(
    'id', 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
    'order', 1,
    'question_text', 'จงหาค่า $x$',
    'given_values', jsonb_build_array(
      jsonb_build_object(
        'symbol', 'a',
        'label', 'สัมประสิทธิ์',
        'value', 2
      )
    ),
    'target_variable', jsonb_build_object(
      'symbol', 'x',
      'label', 'ค่าที่ไม่ทราบ'
    ),
    'solution', jsonb_build_object(
      'steps', jsonb_build_array('แทนค่าและคำนวณ'),
      'final_answer', '$x = 5$'
    )
  );
  v_valid_settings jsonb := jsonb_build_object(
    'lesson', 'Linear equations',
    'scenario', 'Solve for x.'
  );
  v_valid_settings_with_header jsonb := jsonb_build_object(
    'lesson', 'Linear equations',
    'scenario', 'Solve for x.',
    'header', jsonb_build_object(
      'title', 'Quiz 1',
      'instructions', 'Show your work.',
      'fields', jsonb_build_object(
        'showStudentName', true,
        'showDate', true,
        'showClassSection', false,
        'showScoreBox', false
      )
    )
  );
  v_valid_settings_with_difficulty jsonb := jsonb_build_object(
    'lesson', 'Linear equations',
    'scenario', 'Solve for x.',
    'math_complexity', 'decimals',
    'conceptual_difficulty', 'level_2',
    'target_randomize', true
  );
  v_many_given jsonb;
begin
  select jsonb_agg(
    jsonb_build_object('symbol', 'a', 'label', 'l', 'value', 1)
  )
  into v_many_given
  from generate_series(1, 13);

  perform set_config('test.valid_question', v_valid_question::text, true);
  perform set_config('test.valid_settings', v_valid_settings::text, true);
  perform set_config('test.valid_settings_with_header', v_valid_settings_with_header::text, true);
  perform set_config('test.valid_settings_with_difficulty', v_valid_settings_with_difficulty::text, true);
  perform set_config(
    'test.oversized_header_title_settings',
    jsonb_build_object(
      'lesson', 'ok',
      'scenario', 'ok',
      'header', jsonb_build_object('title', repeat('t', 121))
    )::text,
    true
  );
  perform set_config(
    'test.invalid_header_field_settings',
    jsonb_build_object(
      'lesson', 'ok',
      'scenario', 'ok',
      'header', jsonb_build_object(
        'fields', jsonb_build_object('showStudentName', true, 'invalidField', true)
      )
    )::text,
    true
  );
  perform set_config(
    'test.oversized_question',
    (v_valid_question || jsonb_build_object('question_text', repeat('x', 4001)))::text,
    true
  );
  perform set_config(
    'test.many_given_question',
    (v_valid_question || jsonb_build_object('given_values', v_many_given))::text,
    true
  );
  perform set_config(
    'test.oversized_settings',
    jsonb_build_object('lesson', 'ok', 'scenario', repeat('s', 501))::text,
    true
  );
  perform set_config(
    'test.oversized_lesson_settings',
    jsonb_build_object('lesson', repeat('l', 161), 'scenario', 'ok')::text,
    true
  );
  perform set_config(
    'test.invalid_math_complexity_settings',
    jsonb_build_object(
      'lesson', 'ok',
      'scenario', 'ok',
      'math_complexity', 'fractions'
    )::text,
    true
  );
  perform set_config(
    'test.invalid_conceptual_difficulty_settings',
    jsonb_build_object(
      'lesson', 'ok',
      'scenario', 'ok',
      'conceptual_difficulty', 'level_9'
    )::text,
    true
  );
  perform set_config(
    'test.invalid_target_randomize_settings',
    jsonb_build_object(
      'lesson', 'ok',
      'scenario', 'ok',
      'target_randomize', 'yes'
    )::text,
    true
  );
  perform set_config(
    'test.valid_multi_target_settings',
    jsonb_build_object(
      'lesson', 'Motion',
      'scenario', 'Find values.',
      'target_variables', jsonb_build_array(
        jsonb_build_object('symbol', 'v', 'label', 'velocity'),
        jsonb_build_object('symbol', 'a', 'label', 'acceleration')
      ),
      'target_randomize', true
    )::text,
    true
  );
  perform set_config(
    'test.oversized_target_settings',
    jsonb_build_object(
      'lesson', 'Motion',
      'scenario', 'Find values.',
      'target_variables', (
        select jsonb_agg(jsonb_build_object('symbol', 'x' || n, 'label', 'target ' || n))
        from generate_series(1, 7) as n
      )
    )::text,
    true
  );
end;
$$;

select ok(
  public.is_valid_worksheet_question(current_setting('test.valid_question')::jsonb),
  'valid worksheet question passes'
);

select ok(
  public.is_valid_generation_settings(current_setting('test.valid_settings')::jsonb),
  'valid generation settings passes'
);

select ok(
  not public.is_valid_worksheet_question(current_setting('test.oversized_question')::jsonb),
  'question_text over 4000 chars is rejected'
);

select ok(
  not public.is_valid_worksheet_question(current_setting('test.many_given_question')::jsonb),
  'more than 12 given_values is rejected'
);

select ok(
  not public.is_valid_generation_settings(current_setting('test.oversized_settings')::jsonb),
  'scenario over 500 chars is rejected'
);

select ok(
  not public.is_valid_generation_settings(current_setting('test.oversized_lesson_settings')::jsonb),
  'lesson over 160 chars is rejected'
);

select ok(
  public.is_valid_generation_settings(current_setting('test.valid_settings_with_header')::jsonb),
  'valid generation settings with header passes'
);

select ok(
  not public.is_valid_generation_settings(current_setting('test.oversized_header_title_settings')::jsonb),
  'header title over 120 chars is rejected'
);

select ok(
  not public.is_valid_generation_settings(current_setting('test.invalid_header_field_settings')::jsonb),
  'invalid header field keys are rejected'
);

select ok(
  public.is_valid_generation_settings(current_setting('test.valid_settings_with_difficulty')::jsonb),
  'valid generation settings with difficulty fields passes'
);

select ok(
  not public.is_valid_generation_settings(current_setting('test.invalid_math_complexity_settings')::jsonb),
  'invalid math_complexity value is rejected'
);

select ok(
  not public.is_valid_generation_settings(current_setting('test.invalid_conceptual_difficulty_settings')::jsonb),
  'invalid conceptual_difficulty value is rejected'
);

select ok(
  not public.is_valid_generation_settings(current_setting('test.invalid_target_randomize_settings')::jsonb),
  'non-boolean target_randomize is rejected'
);

select ok(
  public.is_valid_generation_settings(current_setting('test.valid_multi_target_settings')::jsonb),
  'valid generation settings with multiple target_variables passes'
);

select ok(
  not public.is_valid_generation_settings(current_setting('test.oversized_target_settings')::jsonb),
  'more than 6 target_variables is rejected'
);

select ok(
  not public.is_valid_worksheet_question(
    jsonb_build_object(
      'id', 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
      'order', 1,
      'question_text', repeat('x', 33000),
      'given_values', jsonb_build_array(
        jsonb_build_object('symbol', 'a', 'label', 'l', 'value', 1)
      ),
      'target_variable', jsonb_build_object('symbol', 'x', 'label', 'l'),
      'solution', jsonb_build_object(
        'steps', jsonb_build_array('step'),
        'final_answer', '1'
      )
    )
  ),
  'question jsonb over 32KB is rejected'
);

select * from finish();

rollback;

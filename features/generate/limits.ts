/** Payload caps mirrored in supabase/migrations/20260607000000_payload_size_limits.sql */
/** Question count caps mirrored in supabase/migrations/20260610000000_worksheet_question_limit_constants.sql */
export const MAX_WORKSHEET_QUESTION_COUNT = 40
export const MAX_INITIAL_WORKSHEET_QUESTION_COUNT = 20
export const MAX_EXTEND_QUESTIONS_PER_REQUEST = 20

export const MAX_LESSON_LEN = 160
export const MAX_SCENARIO_LEN = 500
export const MAX_SYMBOL_LEN = 32
export const MAX_LABEL_LEN = 120
export const MAX_UNIT_LEN = 32
export const MAX_GIVEN_STRING_VALUE_LEN = 64
export const MAX_GIVEN_VARIABLES = 12
export const MAX_TARGET_VARIABLES = 6
export const MAX_QUESTION_TEXT_LEN = 4000
export const MAX_SOLUTION_STEPS = 24
export const MAX_SOLUTION_STEP_LEN = 2000
export const MAX_FINAL_ANSWER_LEN = 500
// TikZ source is the durable, persisted diagram field (small). The compiled
// `diagram_svg` is a transient render artifact assembled server-side from it and
// is *not* meant to live in the persisted question JSON — see the note on
// `MAX_QUESTION_JSON_BYTES` below.
export const MAX_TIKZ_CODE_LEN = 8000
// Self-contained diagram SVGs embed subsetted TeX fonts, so they run large.
// Kept well above `MAX_QUESTION_JSON_BYTES` on purpose: `diagram_svg` is a
// render-time payload, never persisted inline in the question row.
export const MAX_DIAGRAM_SVG_LEN = 400000
export const MAX_QUESTION_JSON_BYTES = 32768
export const MAX_HEADER_TITLE_LEN = 120
export const MAX_HEADER_INSTRUCTIONS_LEN = 300

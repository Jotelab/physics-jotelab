# Sandbox port: star difficulty, engine diagrams, topic cards

This branch ports the jotelab-sandbox testbench's capabilities into the real
app and rebuilds lesson selection as multi-select topic cards.

## What was ported

**Engine-authored TikZ diagrams** (`lib/tikz/engine-diagram.ts`, wired in
`lib/tikz/templates/index.ts`)

The sandbox's serializer for the engine's `sympy_data.diagram` payload
(motion-1d / plot-2d / actors, answer-hiding built in). `buildTemplateTikz`
now prefers an engine-authored spec over the local per-topic builders, so
9 of the 11 engine topics get figures at the display boundary instead of just
`suvat`. (The sandbox's other upstream finding — `auxiliary`/`diagram`
surviving the Zod boundary — was already fixed on this branch.)

**Hidden-condition plumbing** (`lib/engine/client.ts`,
`lib/ai/generate-engine-question.ts`)

`engineGenerate` gains the sandbox's `conditions` parameter (pin exact values
onto givens). The phrasing prompt renders a hidden given as its worded event
("dropped from rest"), never as a number; the existing fidelity gate already
exempts zero-valued givens, and every hidden condition in the star pool is
zero-valued.

**The star ladder** (`lib/engine/star-plans.ts`, wired in
`features/generate/generate-question-core.ts`)

The full 23-plan pool (1★ direct → 5★ cross-topic chains) with per-order
seeded selection: a worksheet's `star_difficulty` picks a plan per question,
filtered by that question's engine topic, walking down a star when the topic
has no plan at the requested level, falling back to a plain engine call when
no star covers the topic. Star plans pin the whole given/find/conditions
split, so they take precedence over advanced-mode variable pins.
Regeneration re-pins zero-valued givens so a re-roll keeps the structure.

**Not ported — 5★ chain generation.** Chain plans need multi-part questions;
the persisted question format is single-part (and part symbols collide when
flattened), so 5★ is selectable in code (`STAR_PLANS[5]`) but locked in the
UI and capped by `MAX_GENERATABLE_STARS` in generation. Unlocking it needs a
multi-part `format` member in `worksheetQuestionSchema`, a DB
`is_valid_worksheet_question` migration, and a chain client — a follow-up.

## The new generate config

**Topic cards** (`features/generate/components/lesson-card-grid.tsx`)

Lesson selection is a checkbox-card grid of the 11 engine-backed topics —
name + description per card (i18n `presets.lessonDescriptions`, en/th),
multi-select, playful-design styling (spring press, popping check). Picking
several topics generates a mixed worksheet: question orders rotate through
the topics (`lessons` in the generation settings, round-robin in
`generate-question-core`). A free-text combobox stays available under
"Or type a custom topic" for the LLM-only lessons; typing clears the cards
and vice versa.

**Star difficulty control**
(`StarDifficultySelect` in `difficulty-select.tsx`)

Card selections show the 1–5★ tactile star control (5★ visible but locked
with an explanation); a custom free-text topic keeps the old conceptual
difficulty dropdown. Math complexity stays a separate numbers knob in both
modes.

**Config plumbing:** `generateWorksheetInputSchema` and
`generationSettingsSchema` gain optional `lessons` (mixed topics) and
`star_difficulty`; both are absent for old worksheets, which behave exactly
as before.

## How to test

```bash
npm run lint    # passes clean
npm test        # 631 passed, 1 skipped (star-plans, engine-diagram, config-form cases included)
npm run build   # validates the full app compiles
npx vitest run lib/engine/star-plans.test.ts lib/tikz/engine-diagram.test.ts
```

By eye in `npm run dev` (needs the engine service running for real
generation — see jotelab-sandbox/engine-service/run.sh, and set
`ENGINE_BASE_URL`/`ENGINE_API_KEY` in `.env.local`):

1. `/generate` — the Lesson combobox is now a card grid; each card shows the
   topic name and description, and toggles with a popping check.
2. Pick one card → scenario picker appears (per-topic scenarios); pick 2+
   cards → scenario picker is replaced by the mixed-topics hint and
   generation rotates topics across question orders.
3. With any card selected, "Conceptual difficulty" is replaced by the
   "Star difficulty" 1–5★ control; hover 5★ for the lock explanation. Clear
   cards and type a custom topic → the conceptual dropdown returns.
4. Generate at 3★ with the Free fall card: expect wordings like "dropped from
   rest" with no `u = 0` stated numerically; the answer key still shows u = 0
   among the givens.
5. Generate with a topic other than Motion in one dimension and open the
   worksheet: topics like Upward throw / Motion graphs / Relative velocity
   now render engine-authored TikZ figures (previously suvat only).
6. Regenerate a 3★ question — the new roll keeps its hidden condition
   (a zero-valued given stays zero, phrased in words).

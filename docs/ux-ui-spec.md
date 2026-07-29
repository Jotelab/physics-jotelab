# UX / UI specification

## Design principles

- **Thai-first.** Learner-facing copy is Thai (`messages/th.json`, hand-authored
  coach explanations); English is secondary (`messages/en.json`, next-intl).
- **Mint-green identity.** The palette's primary is mint green across light and
  dark modes (`app/globals.css` tokens; `next-themes` toggle). Components come
  from the shadcn-style set in `components/ui/`.
- **Print is a first-class surface.** Worksheets render on an A4 canvas and
  export as vector PDF — diagrams must stay sharp at ≥400% zoom (ADR-006/007).
- **Trust is visible.** Numbers, steps, and answers are rendered from
  `sympy_data` via KaTeX (`react-katex`); the UI never re-formats a computed
  value by hand.

## Surfaces and layout

| Surface | Layout | Notes |
| --- | --- | --- |
| `/generate` | dashboard shell, config panel + live A4 preview | auth-gated (`proxy.ts`) |
| `/library`, `/account` | dashboard shell | auth-gated |
| `/learn` | standalone, max-w-2xl single column | public — no account needed for a coached solve |
| `/login` | auth group | Supabase OAuth |

The dashboard shell (`components/layout/dashboard-shell.tsx`) provides nav,
skip-link accessibility, and the locale/theme controls.

## The coached-solve flow (`/learn`)

1. Problem card: deterministic Thai statement of the givens and the sought
   quantity.
2. **Step ① equation** — 4-option MCQ rendered in KaTeX; options are seeded
   per question so a revisit looks identical.
3. **Step ② substitution** — one labelled numeric field per given, unit shown
   beside each field; the check button stays disabled until every field parses.
4. **Step ③ answer** — single numeric field with the target unit.
5. Wrong input → hint panel escalates: muted nudge → amber targeted
   explanation → worked step (engine LaTeX) with an "isomorphic re-roll" offer.
6. Solved → full worked solution + "same-structure new problem" / "new
   problem" actions.

States: correct steps collapse to a "✓ ถูกต้อง" line; later steps stay hidden
until earlier ones pass, so the page reads top-to-bottom as the solution path.

## Accessibility

- Hint panels use `role="status"` so screen readers announce feedback.
- All inputs are `<Label>`-bound; `inputMode="decimal"` brings up numeric
  keyboards on mobile.
- Color is never the only signal (✓ text, borders, and copy accompany it).

## How to test

```bash
npx vitest run features/coach components 2>/dev/null || npm run test
npm run dev   # visit /learn: complete a solve with one deliberate mistake per
              # step and confirm the hint names the mistake before revealing
npm run test:e2e:public   # public-surface Playwright checks
```

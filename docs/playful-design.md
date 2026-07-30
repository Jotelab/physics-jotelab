# Playful "physics personality" design layer

This branch (`playful-design`) applies a playful visual layer to the app chrome.
The organizing idea: the app should *behave* like physics, not wear physics
clip-art. Printed worksheet output is deliberately untouched.

## What changed

**Tokens & type** (`app/globals.css`, `app/layout.tsx`, `lib/ui-classes.ts`)

- Base radius `0.625rem → 0.8rem` — cards, buttons, and fields all soften.
- New heading stack `--font-heading`: Baloo 2 (Latin) falling through to Mitr
  (Thai), applied via `font-heading` in `pageTitleClass`, `sectionTitleClass`,
  and `PageState`. Body text stays Geist / Noto Sans Thai.
- New motion tokens: `--ease-spring` (overshoot bezier), `--animate-pendulum`
  (sinusoidal swing ≈ small-angle pendulum), `--animate-star-pop`. All are
  disabled under `prefers-reduced-motion`.

**Pendulum loader** (`components/loading/physics-loader.tsx`)

Replaces the pulsing A4 rectangle in `GeneratePreviewSkeleton`: a swinging
pendulum SVG plus rotating lab-notebook phrases from the new `loader` i18n
namespace ("Solving for x…", "Converting units…", …) in both locales.

**Doodle system** (`components/doodles.tsx`)

Hand-drawn-style SVGs sharing one stroke language (2.5px, round caps; accents
in chart palette periwinkle/gold). Placements:

- `InclinedPlaneDoodle` — empty library state
- `SpringDoodle` — login card
- `EscapedPageDoodle` — both 404 pages (via new `illustration` prop on `PageState`)
- `PendulumDoodle` (static) — idle worksheet preview placeholder (`print:hidden`)

**Tactile difficulty stars** (`features/generate/components/difficulty-select.tsx`)

The conceptual-difficulty dropdown now renders a gold star row per level
(1–3), popping in sequence on the trigger when the selection changes.
`BuilderSelectDropdown` gained optional `renderOption` / `renderValue` props;
the accessible label text is unchanged.

**Buttons** (`components/ui/button.tsx`)

Press feedback gains mass: `active:scale-[0.97]` with spring easing, guarded
by `motion-reduce`.

**Microcopy** (`messages/en.json`, `messages/th.json`)

Warmed empty-library, empty-preview, and 404 strings. Thai strings are written
natively, not translated English wordplay.

## Where playfulness stops

- Print output (`@media print`, `.worksheet-page`) — no doodles, no display
  font, no animation. The only doodle inside a printable container is wrapped
  in `print:hidden`.
- Error states other than 404, forms, and destructive dialogs stay plain.

## How to test

```bash
npm run lint       # eslint — passes clean
npm test           # vitest — 613 passed, 1 skipped
npm run build      # validates CSS @theme keyframes + Google font wiring
npm run dev        # then check by eye:
```

By eye in `npm run dev`:

1. `/login` — spring doodle above the app name; heading in Baloo 2.
2. `/generate` — reload to catch the pendulum loader while the preview panel
   loads; idle preview shows the resting pendulum; change "Conceptual
   difficulty" and watch the stars pop.
3. `/library` (empty account) — inclined-plane doodle + Newton empty-state copy.
4. Any bad URL — escaped-page doodle and the "observable universe" 404 copy.
5. Switch language to ไทย and repeat 1–4; headings should render in Mitr.
6. Print preview a generated worksheet — output must look exactly as before
   (no doodles, Geist/Noto headers, black on white).
7. OS-level "reduce motion" — pendulum and stars freeze, buttons stop scaling.

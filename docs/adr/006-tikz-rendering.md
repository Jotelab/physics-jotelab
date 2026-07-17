# ADR-006 — TikZ rendering: server compile → self-contained SVG

- **Status:** Accepted (2026-07-06)
- **Phase:** DEVELOPMENT_PLAN §2.1 (TikZ: rendering first, independent of AI)
- **Supersedes/relates:** ADR-001 (Neuro-Symbolic Split)

## Context

The proposal (objective #3) promises TikZ diagrams that render in the interactive
A4 canvas **and** export to PDF as vector. The plan asks us to spike **TikZjax**
(the tool named in the proposal) against a **server-side LaTeX→SVG** fallback,
pick whichever renders our two target diagram families (free-body diagrams and
DC-circuit diagrams) reliably, and record the choice here.

Hard requirements the renderer must satisfy:

1. **Vector in the canvas and in exported PDF** — survives `window.print()` and
   zoom without rasterizing.
2. **Deterministic, synchronous height** — the A4 pagination measures each
   question block (`paginate-items.ts` / `use-worksheet-pagination.ts`); an
   async render that changes height after measurement breaks pagination.
3. **No render-time network dependency** — worksheets must display and print
   offline (demo-day robustness; see the risk register).
4. **Testable** — the pipeline must be unit-testable in Vitest/jsdom.

## Options considered

### A. TikZjax in the browser (proposal's named tool)

Loads a ~1–3 MB WASM TeX engine + fonts from `tikzjax.com` and rewrites
`<script type="text/tikz">` nodes into SVG on the client.

- ➖ Renders **asynchronously** after a global script boots — fights React's
  lifecycle and, critically, the pagination measurement pass (req. 2).
- ➖ **CDN dependency at render/print time** (req. 3) — a demo-day network blip
  yields blank diagrams.
- ➖ **Not unit-testable** in jsdom (req. 4); SSR-incompatible.
- ➕ Matches the proposal literally; zero backend work.

### B. Server compile → stored SVG string (chosen)

Compile TikZ → SVG on the server with **node-tikzjax** (the same TeX+dvi2svg
engine as TikZjax, packaged for Node), embed the referenced fonts, sanitize, and
hand the finished SVG string to the client on the question object.

- ➕ **Vector** output (`<path>` shapes; glyphs as positioned `<text>` with
  embedded fonts) — prints crisp at any zoom (req. 1).
- ➕ The SVG is a **plain string already in the DOM** on first render, so its
  height is deterministic and synchronous (req. 2).
- ➕ **Self-contained**: we base64-embed only the Computer Modern families each
  diagram references, so there is **no render-time fetch** (req. 3).
- ➕ Compilation is a **pure, injectable** step — the orchestration unit-tests
  with a fake compiler; the TeX WASM is loaded lazily and never touches jsdom
  (req. 4). Deterministic output is cacheable by `(topic, seed)`.
- ➖ Adds a compile step (a Node route/service) and a build dependency.

## Decision

Adopt **Option B**. TikZ is compiled to a self-contained SVG on the server; the
client only ever renders a trusted, sanitized SVG string.

Note that **node-tikzjax is TikZjax** — same TeX engine and dvi2svg pipeline —
run server-side instead of in the browser. So this satisfies the proposal's
"TikZjax" commitment while meeting the reliability/pagination/print constraints
the client-side variant cannot.

### Shape of the implementation

- `lib/tikz/wrap-document.ts` — wraps raw `tikzpicture` in the
  `\begin{document}…\end{document}` body the engine needs.
- `lib/tikz/embed-fonts.ts` — inlines the referenced TeX fonts as base64
  `@font-face` rules (pure; font bytes injected) so the SVG is portable.
- `lib/tikz/sanitize-svg.ts` — strips scripts/handlers/`foreignObject`/external
  refs/`@import` before the SVG is injected via `dangerouslySetInnerHTML`.
- `lib/tikz/compile.ts` — `server-only` orchestrator; lazily imports
  node-tikzjax, fails closed with `TikzCompileError`.
- `app/api/tikz/compile/route.ts` — authenticated Node-runtime endpoint.
- Rendering: `features/worksheet/components/tikz-diagram.tsx`, wired into the
  question block; `diagram_svg` is added to the pagination fingerprint so the
  measured height re-computes when a diagram changes.
- `next.config.ts` marks `node-tikzjax` as a `serverExternalPackages` entry.

### Data model

The question carries two optional fields: `tikz_code` (the durable, persisted
diagram **source**) and `diagram_svg` (the compiled, render-time artifact).
`diagram_svg` embeds fonts and therefore runs large — it is **not** persisted
inline in the question JSON (it would blow `MAX_QUESTION_JSON_BYTES`); the
storage/caching strategy is a Phase 2.2 concern.

## Consequences

- The client bundle carries **no** TeX/WASM; only a static SVG string.
- The `/api/tikz/compile` route runs a TeX engine on request input — gated on an
  authenticated session and a length cap today; **rate-limiting is a follow-up**
  before wider exposure.
- If a future diagram family needs a package node-tikzjax can't provide, the
  server-side seam lets us swap in a full LaTeX→SVG service without touching the
  client renderer.

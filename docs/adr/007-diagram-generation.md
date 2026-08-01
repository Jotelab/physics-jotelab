# ADR-007 — Diagram generation: web-side templates derived from `sympy_data`

- **Status:** Accepted (2026-07-06)
- **Phase:** TikZ diagram generation, plus the compilation-rate benchmark hook
- **Builds on:** ADR-006 (server compile → self-contained SVG)

## Context

Phase 2.2 asks for **templated TikZ** diagrams (deterministic, always compile)
for structured cases, the **"Structured AI Output" `{ text, katex, tikz }`
split**, and later **LLM-generated TikZ** behind compile-validation. The plan's
wording puts templates "emitted by the engine" (`templates/circuits.py`).

Two facts shape where the template logic actually lives:

1. **The compiled SVG can't be persisted in the question row.** A self-contained
   SVG embeds fonts (~40 KB); the question JSON has a 32 KB cap
   (`MAX_QUESTION_JSON_BYTES`, enforced by the DB allowlist). Adding `tikz_code`
   to storage would also mean a migration mirroring the `sympy_data` one
   (allowlist + every completion/replace/reconcile RPC).
2. **The SUVAT diagram is a pure function of `sympy_data`**, which is *already*
   persisted. So the diagram needs no new stored field at all — it can be
   re-derived on read.

## Decision

For the deterministic template path, **derive the TikZ in the web app from the
persisted `sympy_data`, on read, and compile it with ADR-006's compiler** — no DB
migration, no new persisted field.

- `lib/tikz/templates/suvat.ts` — a variable-consistent SUVAT **motion diagram**
  (object, velocity arrows, acceleration arrow, displacement/elapsed-time
  brackets). It labels only the quantities the instance actually involves (its
  Given set ∪ Find), with **math symbols only** (`$v_0$`, `$a$`, `$s$`, `$v$`,
  `$t$`) — never values, so the answer stays hidden and every glyph is inside
  node-tikzjax's Latin/math fonts (Thai labels would not compile).
- `lib/tikz/templates/index.ts` — topic → builder registry.
- `lib/tikz/attach-diagram.ts` (`server-only`) — at the **display boundary**
  (generation poll, `loadWorksheetQuestionsForProfile`, saved-worksheet view)
  re-derive the TikZ, compile it (cached by source, best-effort), and attach
  `tikz_code` + `diagram_svg`. Internal generation reads (existing-question
  context) skip it, so no needless compiles.

### Why a motion diagram, not a free-body diagram

The plan lists "free-body diagram for SUVAT/dynamics". A force diagram is not
meaningful for pure kinematics; the motion diagram is the kinematics-appropriate
figure. A true free-body diagram lands with dynamics (F = ma) in Phase 4.

### The `{ text, katex, tikz }` split

Implemented as a narrower **model-output schema**
(`modelCalculationOutputSchema`) passed to `generateObject` in every LLM entry
point (generate / regenerate / variant). It omits `tikz_code`, `diagram_svg`,
and `sympy_data`: the model authors **only** prose (`text`) and math (`katex`,
i.e. the solution), never the diagram or the engine payload. This also closes a
latent gap from §2.1 — the storage schema had gained optional `tikz_code` /
`diagram_svg`, which the model could otherwise emit into a payload the DB
allowlist rejects.

### Benchmark hook (§2.3)

`lib/tikz/compilation-log.ts` writes one stable `[tikz-compile]` line per attempt
(`source` = template | llm, `ok` = pass | fail). The Phase 5 **TikZ Compilation
Rate** metric is a grep+count over these.

## Consequences / deferred

- **No migration, no drift:** the diagram is a deterministic view of verified
  engine numbers. The neuro-symbolic invariant holds — the LLM never authors the
  shown geometry.
- **Compile-on-read cost** is bounded by an in-process cache (one compile per
  distinct diagram per process); `E2E_STUB_GENERATION` skips it entirely.
- **LLM-generated TikZ (the "then add" bullet) is deferred.** It is not derivable
  from `sympy_data`, so showing it consistently across reloads needs the
  `tikz_code` persistence migration. The pieces are staged for it: the benchmark
  hook already models a `"llm"` source, and the template is the guaranteed
  fallback the validated-LLM path will fall back to.
- **Phase 4 circuits** may genuinely need topology the numeric `sympy_data`
  doesn't carry; that is the point at which template logic may move engine-side
  (`templates/circuits.py`) and travel in the contract.

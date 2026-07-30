# Schema Adherence (first-pass Zod validity)

Share of production `generateObject` phrasing calls whose first pass already
matched the Zod schema. Same run as prose-data-fidelity.md.

| Metric | Value |
|---|---|
| Phrasing calls (first attempts) | 0 |
| First-pass schema-valid | 0 |
| **Schema Adherence** | **n/a** |

## How to test

```bash
# Same command as prose-data-fidelity.md — one run produces both artefacts.
PROSE_BENCHMARK=1 npx vitest run benchmarks/prose-fidelity.test.ts
```

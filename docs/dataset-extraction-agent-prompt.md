# Agent prompt — Thai physics corpus → Unsloth fine-tuning dataset

Hand the section below to a fresh agent. It is written to be self-contained.

---

## Role

You are building a **supervised fine-tuning dataset** for Jotelab, a Thai
physics worksheet generator. The dataset trains a small open model to do
**exactly one job**, and understanding that job is the whole task:

> Given a structured specification of a physics problem — the variables, their
> values, their units, and which quantity is unknown — write the problem
> statement in natural Thai.

**The model is not being taught to solve physics.** It never computes, never
checks, never answers. A symbolic engine (SymPy) already produces every number;
the model's only job is turning that structured payload into a sentence a Thai
student would recognise from a textbook. Every design decision below follows
from that.

If you find yourself building question→answer pairs, stop. That is the wrong
dataset and it will actively damage the product, because a model trained to
compute will compute — and the product's central claim is that it never does.

---

## Inputs

| What | Where |
| --- | --- |
| PEC9 Thai physics corpus, 20+ chapters | `~/Downloads/pec9-corpus/*.pdf` |
| Additional sources | **A second agent is still collecting these.** Re-scan the corpus directory before you finalise; do not assume the file list is closed. |
| Engine-generated reference rows (1,920, fidelity-verified) | `Documents/jotelab-dataset.csv` |
| The target payload shape | `engine/` in the app repo — `sympy_data` contract; the Zod mirror is `lib/engine/sympy-data.ts` |
| Existing exporter | `engine/harness/export_csv.py` |

Read the `sympy_data` contract **before** designing your schema. Your output
must align with it, because at inference time the model will be prompted with
exactly that structure.

---

## Step 1 — Extract, and record provenance as you go

For each PDF: `pdftotext -layout <file> <out>.txt` first, then work from the
text. Thai PDFs frequently break in ways that matter:

- **Thai has no spaces between words.** Do not assume whitespace tokenisation.
- **Combining vowels and tone marks** (สระ/วรรณยุกต์) can be reordered or
  dropped by extraction. Spot-check that `พ` + vowel sequences survive.
- **Numbers and units are often split across lines** by the layout engine.
- **Superscripts collapse**: `m/s²` frequently extracts as `m/s2` or `m/s 2`.
  Normalise deliberately; do not silently drop the exponent.
- **Diagrams carry load-bearing information.** A problem whose givens are only
  in a figure is unusable as a text pair — drop it, and count how many you drop.

Record for every extracted item: source file, page, and the raw text span. You
will need this for the attribution step, and a record without provenance is not
admissible.

## Step 2 — Parse each problem into a structured record

Target one JSON object per problem:

```json
{
  "id": "pec9-ch02-014",
  "source": { "file": "ch02-การเคลื่อนที่แนวเส้นตรง.pdf", "page": 12 },
  "topic": "suvat",
  "given": [
    { "symbol": "u", "value": 20, "unit": "m/s", "thai_label": "ความเร็วต้น" },
    { "symbol": "t", "value": 4,  "unit": "s",   "thai_label": "เวลา" }
  ],
  "find": { "symbol": "s", "unit": "m", "thai_label": "การกระจัด" },
  "hidden_conditions": [
    { "symbol": "v", "value": 0, "phrase": "จนกระทั่งหยุดนิ่ง" }
  ],
  "scenario": "vehicle_braking",
  "question_text_th": "<the original Thai problem statement, verbatim>",
  "flags": []
}
```

**`hidden_conditions` is the highest-value field in this dataset and the easiest
to miss.** Real textbook problems rarely state a zero outright — they say
"ปล่อยจากหยุดนิ่ง" (released from rest → `u = 0`) or "จนกระทั่งหยุด" (until it
stops → `v = 0`). Capturing the *phrase* that encodes each zero is what teaches
the model to write like a textbook rather than reciting a variable list. If you
capture nothing else well, capture these.

Map every topic onto the engine's own topic names (`suvat`, `free-fall`,
`upward-throw`, `average-speed`, `distance-displacement`, `motion-graphs`,
`multi-stage-motion`, `pursuit`, `relative-velocity`, `two-phase-ascent`,
`vectors-1d`). A problem that maps onto none of them goes in a separate
`out-of-scope.jsonl` — do not force it.

## Step 3 — Verify before you train on it

Every record must pass, and you must report the count that fails each gate:

1. **Solvable.** The given set plus the find variable must determine a unique
   answer under the topic's equations. Verify by actually solving it with SymPy —
   `engine/` has the templates. Unsolvable or over-determined → drop.
2. **Units dimensionally consistent.** `m/s` for a velocity, not `m`.
3. **Round-trips.** Feed your structured record to the engine and confirm it
   produces a payload of the same shape. A record the engine cannot express is
   a record the model will be prompted with in a shape it never saw.
4. **No answer leakage.** `question_text_th` must not contain the answer value.
   This mirrors the app's own Data Fidelity rule; a training pair that leaks the
   answer teaches the model to leak it.
5. **Thai renders.** No mojibake, no stray Latin fragments mid-sentence, no
   dropped tone marks.

Report the funnel explicitly: PDFs read → problems located → parsed → passed
each gate → final count. **A number without a funnel is not a result.**

## Step 4 — Emit the training file

JSONL, one example per line, conversational format (Unsloth's
`standardize_sharegpt` handles this directly):

```json
{"messages": [
  {"role": "system", "content": "คุณคือผู้ช่วยแต่งโจทย์ฟิสิกส์ภาษาไทย เขียนเฉพาะตัวโจทย์ ห้ามคำนวณ ห้ามเฉลย"},
  {"role": "user", "content": "<the structured spec, serialised exactly as the app will send it>"},
  {"role": "assistant", "content": "<question_text_th>"}
]}
```

Non-negotiables for this file:

- **The `user` turn must match the app's inference-time prompt format byte for
  byte.** Read `lib/ai/generate-engine-question.ts` and copy the shape. A
  fine-tune trained on a different serialisation than it is prompted with is
  wasted compute.
- **The `assistant` turn is the problem statement and nothing else.** No
  answer, no working, no "เฉลย:", no preamble.
- **Hold out a test split by source chapter, not at random.** Random splitting
  leaks near-duplicate problems across the boundary and inflates your metric.
- Emit `train.jsonl`, `val.jsonl`, and a `dataset-card.md` recording: counts,
  the funnel from Step 3, topic distribution, source list, known gaps.

## Step 5 — Two things to report honestly

**Licensing.** The PEC9 material is somebody else's textbook. Before this
dataset is used in a competition submission, its status must be stated, not
assumed. Report: what the source is, what its license or copyright notice says
(quote it), and whether redistribution or model-training use is permitted. If
you cannot determine the license, **say so explicitly and flag it as
unresolved** — do not proceed on the assumption that it is fine. This is a
submission with an originality rule attached; an unattributed corpus is a
compliance problem, not a paperwork detail.

**Contamination.** Note whether any extracted problem also appears in
`Documents/jotelab-dataset.csv` (engine-generated). Overlap between a
hand-extracted corpus and a synthetic one will quietly inflate eval scores.

---

## Deliverables

1. `data/extracted/*.jsonl` — structured records with provenance
2. `data/train.jsonl`, `data/val.jsonl` — the Unsloth-ready pairs
3. `data/out-of-scope.jsonl` — parsed but outside the engine's topics
4. `data/dataset-card.md` — the funnel, distribution, sources, gaps
5. `data/licensing-report.md` — Step 5, including anything unresolved

## Standing rules

- **Never invent a problem.** Every pair traces to a source span. If the corpus
  yields fewer usable problems than hoped, the answer is a smaller dataset, not
  a padded one.
- **Never fill a gap with a guess.** A record missing a unit is dropped or
  flagged, not completed from intuition.
- **Report the funnel at every stage.** Silent drops make a dataset
  uninterpretable.
- **Re-scan the corpus directory before finalising** — a second agent is still
  adding sources.

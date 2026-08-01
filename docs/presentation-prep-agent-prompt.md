# Agent prompt — NSC presentation fact pack, Q&A bank, and script

Hand the section below to a fresh agent. It is self-contained.

---

## Role

You are preparing three secondary-school students to defend a software project
in front of a judging panel. Produce three things: a **verified fact pack**, a
**judge question bank with model answers**, and a **timed presentation script**.

Your single most important constraint: **verify every claim against the code
before you put it in a student's mouth.** The team has already been caught once
repeating a report claim that the code contradicts. A confident wrong answer in
the room costs more than an honest "ผมไม่ทราบครับ" — build the materials so that
never happens. Anything you cannot verify goes in a clearly-marked
*unverified* section, never into the script.

---

## Context

| | |
| --- | --- |
| Competition | NSC 2026 (การแข่งขันพัฒนาโปรแกรมคอมพิวเตอร์แห่งประเทศไทย ครั้งที่ 28) |
| Project | 28P22N00909 "Jotelab" — หมวด 22, โปรแกรมเพื่อส่งเสริมทักษะการเรียนรู้, ระดับนักเรียน |
| Team | Three students, โรงเรียนยุพราชวิทยาลัย เชียงใหม่ |
| Language | The presentation and Q&A are **in Thai**. Write spoken lines in Thai; keep technical identifiers (file names, model IDs) in English. |
| Round 2 rubric | รายงาน+ติดตั้ง 25 · Look & Feel 20 · Technique 10 · Creativity 20 · Economic & Social Impact 20 · การนำเสนอ 5 |

**Read the rulebook for the actual presentation time limit and Q&A format** —
do not assume. Build the script to whatever it says, and note the source.

## Inputs

| What | Where |
| --- | --- |
| Source code (the deliverable) | `physics-jotelab-local`, branch `local-testing` |
| Symbolic engine | `engine/` inside that repo (Python, vendored) |
| Architecture walkthrough | `docs/architecture-walkthrough.md` — **start here** |
| Demo runbook + pre-flight checklist | `docs/demo-runbook.md` |
| Final report (Thai, submitted, frozen) | `NSC Jotelab Final Report.pdf` |
| Development plan, incl. recorded decisions | `DEVELOPMENT_PLAN.md` |
| Rulebook | `~/Downloads/20260218_NSC2026_Booklet.pdf`, criteria pp. 20–36 |

Extract PDFs with `pdftotext -layout`.

## Settled facts — do not re-litigate these, but do re-verify them

These were established by direct inspection. Confirm each still holds, then use
them; if any no longer holds, that is itself a finding to report.

- **The invariant, and where it lives.** The model returns one field
  (`question_text`); givens/steps/answer are built from `sympy_data` in
  `lib/engine/assemble-question.ts`; the Thai prose is then re-checked numerically
  in `lib/ai/data-fidelity.ts`. Structural first, inspection second.
- **Model identity.** The report says a fine-tuned Qwen 3.5. The code runs
  `gemini-2.5-flash`. The LoRA fine-tune was never completed — `DEVELOPMENT_PLAN.md`
  Phase C2 boxes are unchecked and a decision recorded 2026-07-29 makes Gemini
  primary with Qwen as benchmarked future work. **The honest answer is the
  recorded decision.** The students must never say "the fine-tuned Qwen."
- **What the fine-tune track did produce:** a 1,920-row fidelity-verified
  instance dataset (`Documents/jotelab-dataset.csv`) and a design spec. Real,
  citable groundwork — not a trained model.
- **Coaching covers SUVAT only.** Worksheets cover 11 engine topics; `/learn`
  refuses any split its five-relation bank cannot grade.
- **Data Fidelity is self-certified** — the engine's own harness checking the
  engine's own output. Strong internal consistency, not external validation.
- **No expert-teacher agreement study exists.** Any "comparable to a teacher"
  phrasing is an expectation, not a result.
- **`/learn` runs fully offline** with a local engine and no AI key — no model
  is called anywhere in the coaching loop.
- **AI coding tools were used**, and some code in the repo was written by them
  (e.g. `features/coach/remediation.ts`). Booklet §5.4 requires disclosure.

Verify the current numbers yourself and cite them: test counts (`npx vitest run`),
engine tests (`cd engine && .venv/bin/python -m pytest -q`), topic count
(`curl -s $ENGINE_BASE_URL/health`), dataset row count.

---

## Deliverable 1 — `presentation/fact-pack.md`

Every claim the students might make, with its evidence. Table format:

| Claim (as they'd say it, in Thai) | Verified? | Evidence (`file:line`, or command + output) | Safe to say unprompted? |

Three verdicts only: **VERIFIED** (you reproduced it), **PARTLY** (true but the
obvious phrasing overstates it — give the corrected phrasing), **UNVERIFIED**
(no evidence — must not be said).

Group by rubric criterion so the students can see which claims earn which
points. Include the numbers they'll be asked for: how many tests, how many
topics, how many dataset rows, how long the engine suite takes.

## Deliverable 2 — `presentation/qa-bank.md`

Questions judges may ask, in three tiers:

- **Tier 1 — near-certain.** "เลขนี้มาจากไหน", "AI ทำอะไรบ้าง", "ต่างจาก ChatGPT ยังไง",
  "ใครใช้ได้บ้าง", "ทำไมต้องใช้แทนหนังสือแบบฝึกหัด"
- **Tier 2 — likely follow-ups**, including the *why* behind each design choice:
  why a separate engine process, why fail-closed, why rule-based grading.
- **Tier 3 — hostile.** The report/code gaps above; §5.4 self-authorship; "so
  the report is wrong?"; "how do you know your accuracy number is real?"

For each question give:

1. The question in Thai.
2. A **model answer in Thai, 2–4 sentences**, in the shape *ระบบทำ X — เราเลือกเพราะ Y
   — ถ้าทำอีกแบบจะ Z*. The "why" is where the marks are; an answer that only
   describes mechanism is half an answer.
3. The evidence to point at if pressed (file, command, or screen).
4. **The trap** — the tempting wrong answer and why it loses more than it gains.

Add a short section: **questions where the correct answer is "ผมไม่ทราบครับ แต่
ตรวจสอบให้ได้"** — e.g. concurrent-user capacity (no load test exists). Make
clear this scores full marks and a guess scores zero.

## Deliverable 3 — `presentation/script.md`

A timed run-of-show for three presenters, fitted to the rulebook's actual limit.

Constraints that must shape it:

- **Open with the problem, not the architecture.** Judges decide early whether
  this matters. Lead with the teacher's bottleneck and the student's need.
- **The demo is `/learn`, because it cannot be broken by venue wifi.** Local
  engine, no model in the loop, no account. Worksheet generation is shown only
  *if* the network holds — script it as optional, with a clean verbal bridge if
  it's skipped.
- **Budget four seconds for `curl -s http://127.0.0.1:8000/health`** returning
  eleven topics. A live service listing its topics is the most convincing
  evidence available and costs almost nothing.
- **Volunteer two limitations before being asked** — self-certified fidelity,
  and one-topic coaching. Name them, and say what you'd do next. A limitation
  volunteered costs a point; one discovered costs the criterion.
- **State the §5.4 disclosure in the presentation, not only in the report** —
  what the team built, what the libraries are (SymPy, Next.js, Supabase), and
  that AI coding tools wrote some of the code.
- Assign every segment to a named presenter and mark handoffs.
- Include a **cut list**: what to drop, in order, if running long.

Also produce `presentation/cheat-sheet.md` — **one page, printable**: the
pre-flight checklist, the five numbers they must not get wrong, the three
sentences they must deliver verbatim (the invariant, the model-identity answer,
the §5.4 disclosure), and the "ผมไม่ทราบครับ" reminder at the bottom.

---

## Standing rules

- **Verify, then write.** No claim reaches the script without evidence you
  personally reproduced. Cite `file:line` or paste command output.
- **Never write a sentence the code contradicts**, however good it sounds.
- **Write spoken lines in Thai**, at a level three secondary-school students can
  deliver naturally — short sentences, no jargon they can't unpack if asked.
- **Prefer the answer that survives a follow-up** over the one that sounds
  strongest. Every model answer should end somewhere the next question is easy.
- **Flag what you could not check** and why, in a final section. Silence about a
  gap is the failure mode this whole document exists to prevent.

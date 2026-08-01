# Architecture walkthrough — generation pipeline and coach

Written so that any team member can open a file and explain what it does, and
answer "where does this number come from?" for anything on screen. Every line
number below was read from this branch; every payload was captured from a
running engine.

---

## 0. The claim, and the two places it is enforced

> Every number a user sees comes from the symbolic engine. The language model
> only writes Thai prose.

That is enforced in two different ways, and knowing which is which is the
answer to most questions:

| Where | How | File |
| --- | --- | --- |
| **Structurally** | The question object is *built from* `sympy_data`. The model's output is only ever assigned to one field, `question_text`. | `lib/engine/assemble-question.ts:40` |
| **By inspection** | The prose is then re-read and every number in it compared against the engine's. | `lib/ai/data-fidelity.ts:62` |

The first makes it impossible for the model to affect a given, a step, or the
answer. The second catches the remaining hole — the model inventing a number
*inside the sentence*.

---

## 1. The generation pipeline (worksheet)

### 1.1 Routing — does this lesson use the engine?

`shouldUseEngine(lesson, subject)` — `lib/engine/topics.ts:184`

```ts
if ((process.env.GENERATION_MODE ?? "neuro_symbolic") === "llm_only") return false
return resolveEngineTopic(lesson, subject) !== null
```

Two facts to know: the default is neuro-symbolic, and a lesson only takes the
engine path if it maps to one of the engine's topics. Lessons with no engine
topic still generate, on the older pure-LLM path.

### 1.2 The orchestrator

`generateQuestionForWorksheet` — `features/generate/generate-question-core.ts:226`

In order: reserve a credit → decide the lesson for this question's position (a
multi-topic worksheet rotates) → resolve a **star plan** if a structural
difficulty was requested → resolve **advanced pins** if the user fixed
variables → call the engine path or the LLM path → persist.

The credit reservation matters for the invariant: if anything downstream fails,
the reservation is cancelled and **the credit is refunded**. There is no
fallback to LLM-computed numbers.

### 1.3 The engine call

`generateEngineQuestion` — `lib/ai/generate-engine-question.ts:160` →
`engineGenerate` — `lib/engine/client.ts:82` → `POST /generate`.

This is a real HTTP call to a Python FastAPI service that **ships in this
repository** under [`engine/`](../engine/) — `engine/service/app.py`, vendored as
a git subtree of `Jotelab/jotelab-ai` so a judge can read and run it from the
same clone.
The response is parsed with a Zod schema (`lib/engine/sympy-data.ts`) before
anything downstream may touch it. A network error, a non-2xx, or a payload that
does not match the contract all raise `EngineError` — and the reservation fails.

**A real payload**, captured from a running engine (`seed: 424242`, split
`u, a, t → v`):

```json
{
  "topic": "suvat",
  "seed": 424242,
  "given": [
    { "symbol": "a", "value": 1, "exact": "1", "unit": "m/s^2" },
    { "symbol": "t", "value": 5, "exact": "5", "unit": "s" },
    { "symbol": "u", "value": 0, "exact": "0", "unit": "m/s" }
  ],
  "find": { "symbol": "v", "value": 5, "exact": "5", "unit": "m/s" },
  "steps": [
    {
      "expr_latex": "v = a t + u",
      "substituted_latex": "v = 0 + 1 \\cdot 5",
      "result_latex": "v = 5\\ \\text{m/s}"
    }
  ],
  "final_answer": { "value": 5, "exact": "5", "unit": "m/s", "latex": "5\\ \\text{m/s}" },
  "policy_applied": "easy",
  "plausible": true,
  "diagram": { "kind": "motion-1d", "orientation": "horizontal", "segments": [ … ] }
}
```

Two things worth being able to say about this payload:

- **Every number carries two forms.** `exact` is a lossless string (`"1/3"`
  stays `"1/3"`); `value` is a JSON display number that may be a rounded form of
  a non-terminating rational. That is ADR-005.

  Be precise about who reads which, because "everything uses `exact`" is not
  true and is checkable in a minute:

  | Consumer | Reads | Why |
  | --- | --- | --- |
  | Coach grading (`oracle.ts:21`, `parseExact`) | `exact` | correctness decision — must be lossless |
  | Solution steps and final answer (`assemble-question.ts:67`) | the engine's `latex` | rendered verbatim, never recomputed |
  | Displayed given values (`assemble-question.ts:50`) | `value` | it is a display field |
  | Data Fidelity gate (`data-fidelity.ts:67`) | `value` | it compares against numbers printed in prose |

  So the honest statement is: **no number is ever computed by the app or the
  model** — the display path renders `value`/`latex` as the engine emitted them,
  and the one place a value is *judged* uses `exact`.
- **The engine also authors the diagram.** `diagram` is a structured scene the
  app renders as TikZ. The model does not draw either.

### 1.4 Phrasing — the only thing the model does

The model is given the givens, the target, and instructions, and returns an
object with exactly one field:

```ts
const phrasingSchema = z.object({ question_text: z.string().min(1).max(MAX_QUESTION_TEXT_LEN) })
```

It is structurally incapable of returning a number to the pipeline, because
there is no field for one.

### 1.5 The Data Fidelity gate

`checkDataFidelity(questionText, sympyData)` — `lib/ai/data-fidelity.ts:62`

Pulls every numeric literal out of the Thai prose (`extractNumbers`, which
knows to ignore `m/s^2` — the `2` is notation, not a value) and applies three
rules:

1. every engine given must appear in the prose — **except zero-valued givens**,
   which are skipped (`if (given === 0) continue`). A zero given is normally
   expressed as a worded condition, "ปล่อยจากหยุดนิ่ง" rather than the digit 0;
   that is the same hidden-condition mechanism the star ladder uses.
2. every number in the prose must be an engine value,
3. the answer must not appear — **unless it coincides with a given**, in which
   case its presence is required by rule 1 and proves nothing. Without that
   guard the two rules contradict each other and no phrasing could ever pass.

On failure: **one** corrective retry with the issues fed back into the prompt;
still failing → throw → reservation fails → credit refunded
(`lib/ai/generate-engine-question.ts:186-205`).

### 1.6 Assembly

`assembleEngineQuestion` — `lib/engine/assemble-question.ts:40`. Givens, target,
steps and final answer are read from `sympy_data`; `question_text` is the only
thing that came from the model; the whole `sympy_data` is attached to the
question and stored verbatim, so the provenance travels with the data.

### If a judge asks…

- *"How do you know the AI didn't change a number?"* — It never had one to
  change. It returns a single text field; the numbers are read from the engine
  payload in `assemble-question.ts`. And the prose is then checked number by
  number against the engine in `data-fidelity.ts`.
- *"What if the engine is down?"* — Generation fails and the credit is refunded.
  We deliberately do not fall back to an LLM-computed question.
- *"Show me."* — `curl -s $ENGINE_BASE_URL/health` lists the topics; the payload
  above is what `/generate` returns.

---

## 2. The coach (`/learn`)

### 2.1 What is different here: no model at all

`app/learn/page.tsx` → `generateCoachProblem` (`features/coach/actions.ts:38`)
→ the same engine `/generate`.

But the Thai problem statement is **assembled deterministically from the
givens** (`oracle.ts`, `assembleQuestionText`) — no model is called anywhere in
the coaching loop. That is why `/learn` works with an engine and no AI key, and
it is the cleanest demo of the architecture you have.

The action retries up to three times if the engine returns a split the coach
cannot grade, and refuses rather than guessing.

### 2.2 The oracle

`buildCoachProblem(sympyData, SUVAT)` — `features/coach/oracle.ts:58` — derives
everything the UI needs from the payload: the correct equation, the fields to
fill, the expected values, the final answer, and the worked step. The student is
graded against the engine's own solution.

`relationForSplit` (`features/coach/equations.ts:48`) is the key idea: a valid
SUVAT split is 3 givens + 1 unknown, and **that set of four variables
determines exactly one equation**. So the correct MCQ answer is not stored
anywhere — it is derived from the split. Distractors are the other relations,
shuffled by a seeded LCG so the same question always renders the same options.

### 2.3 The three checks

| Step | Function | Compares |
| --- | --- | --- |
| ① equation | `checkEquationChoice` (`classify.ts:45`) | chosen relation id vs. the one the split implies |
| ② substitution | `checkSubstitution` (`classify.ts:64`) | each entered value vs. the engine's `exact` |
| ③ answer | `checkAnswer` (`classify.ts:122`) | value vs. `final_answer`, within tolerance |

**Classification order is deliberate, and this is a good question to be ready
for.** In `checkSubstitution`: all-correct → swapped-pair → all-sign-flipped →
generic `value-slip`. Swapped is tested before sign because a u↔v transposition
can look like two unrelated wrong values; testing the *specific* diagnosis first
means the student gets the precise explanation rather than the catch-all. Same
logic in `checkAnswer`: exact → sign flip → known unit factor (×1000, ×3.6, …) →
`arithmetic-slip`. The substitution was already verified by then, so a wrong
number at step ③ can only be arithmetic.

### 2.4 The hint ladder

`hintLevelForAttempt` (`explanations.ts`): attempt 1 → generic nudge, attempt 2
→ the targeted micro-explanation for the diagnosed error, attempt 3+ → the
engine's own worked step. Wrong answers do not reveal the solution until the
ladder is exhausted; then the step is *taught*, not withheld.

All explanation text is hand-authored Thai, one string per error type. No model
writes or judges anything.

### If a judge asks…

- *"Is the AI grading the student?"* — No. Grading compares structured input to
  the engine's verified solution with plain rules. There is no model in this
  loop at all — `/learn` runs with no AI key.
- *"How do you know which mistake they made?"* — Because we know the correct
  step in advance, the difference between a concept error and a slip is
  decidable. The rules are in `classify.ts` and are ordered most-specific first.

---

## 3. Where the invariant could still break — say this before you are asked

1. **Coaching covers SUVAT only.** `buildCoachProblem` refuses any split the
   five-relation bank does not know. Worksheets cover 11 topics; the coach
   covers one.
2. **Data Fidelity is measured by the engine on its own output.** It is a strong
   internal-consistency check, not external validation. Nobody outside the
   project has audited it, and the figure describes generated instances rather
   than classroom outcomes.

   *Say it first:* «เราวัด Data Fidelity ด้วย harness ของเราเอง จึงเป็นการยืนยัน
   ความสอดคล้องภายใน ไม่ใช่การตรวจสอบจากภายนอกครับ»

3. **No expert-teacher baseline exists.** Where the report describes automated
   review as comparable to a teacher's, there is no agreement study behind it —
   no panel, no inter-rater statistic, no sample of teacher-marked work. It is
   an expectation, not a result, and should be stated that way. Note the coach
   itself makes no such claim: it grades against the engine's own solution with
   plain rules, and no model judges anything.

4. **The misconception taxonomy is hand-authored.** The six categories were
   chosen by us, not derived from a study of student work. Rather than assert
   they are right, the app measures whether they are: every diagnosis is logged,
   and `features/coach/taxonomy-evidence.ts` reports the **catch-all share** —
   the fraction landing in `value-slip` / `arithmetic-slip`, the buckets used
   when the classifier knows an answer is wrong but not why. Above 50% the
   taxonomy is reported as `unsupported` and needs revising. The threshold is
   committed in advance so it is a prediction that can fail.
5. **Prose checking is numeric.** The gate verifies the *numbers* in the Thai
   sentence, not that the sentence describes the physics well.
6. **Two processes, one repository.** The engine runs as a separate service
   (it is Python; the app is TypeScript), but its source ships here under
   `engine/`. The TypeScript side mirrors its contract in
   `lib/engine/sympy-data.ts`, guarded by a shared fixture
   (`tests/fixtures/sympy-data-contract.json`). The mirror is the real cost of
   the split: the contract exists in two languages and must be kept in step.

---

## How to test everything above

```bash
# 1. Start the engine (ships in this repo, under engine/)
cd engine && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
ENGINE_API_KEY=dev-secret .venv/bin/uvicorn service.app:app --port 8000
curl -s http://127.0.0.1:8000/health          # → 11 topics

# 2. See a real payload — the numbers, steps and diagram the app never edits
curl -s -X POST http://127.0.0.1:8000/generate \
  -H 'Content-Type: application/json' -H 'X-Engine-Api-Key: dev-secret' \
  -d '{"topic":"suvat","difficulty":"easy","given":["u","a","t"],"find":"v","seed":424242}'

# 3. The invariant, in tests
npx vitest run lib/ai/data-fidelity.test.ts lib/engine   # numbers survive to the UI
npx vitest run features/coach                            # the engine-judged coach loop

# 4. The coach against the live engine (needs NEXT_PUBLIC_SUPABASE_* set to
#    anything — the page needs no account, but the app will not boot without them)
npm run dev    # then open /learn
```

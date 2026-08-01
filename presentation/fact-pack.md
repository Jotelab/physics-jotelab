# Fact pack — NSC 2026 รอบนำเสนอผลงาน (28P22N00909 Jotelab)

Every claim the team might make, with the evidence behind it.

**How to read the verdict column**

| Verdict | Meaning | Rule |
| --- | --- | --- |
| **VERIFIED** | Reproduced on this machine. Say it freely. | — |
| **PARTLY** | True, but the obvious phrasing overstates it. **Use the corrected wording given.** | — |
| **UNVERIFIED** | No evidence exists. **Must not be said.** | If asked, say «ยังไม่ได้วัดครับ» |

**Verification basis**

- Code: `physics-jotelab-local`, branch `local-testing`, HEAD `fff3fc0` (checked 2026-08-01).
  ⚠ This branch moved *during* verification (`3c0f631 → fff3fc0`, a `/learn` app-shell merge).
  The changed files were UI only — `app/learn/page.tsx`, `components/layout/sidebar.tsx`,
  `features/auth/get-user-profile-or-null.ts`, `features/coach/components/coach-session.tsx`,
  `messages/*.json` — none of the invariant code below. **Re-run the numbers on the morning
  of the presentation** if more merges land.
- Engine: run locally from `engine/`, `uvicorn service.app:app --port 8000`.
- Report: `NSC Jotelab Final Report.pdf`, extracted with `pdftotext -layout`.
- Rulebook: `20260218_NSC2026_Booklet.pdf`, pp. 28–32.

---

## 0. The five numbers — do not get these wrong

| # | Number | Value | How to reproduce |
| --- | --- | --- | --- |
| 1 | Engine topics, live | **11** | `curl -s http://127.0.0.1:8000/health` |
| 2 | Engine test suite | **345 passed, 2 skipped** (9–11 นาที) | `cd engine && .venv/bin/python -m pytest -q` |
| 3 | Web test suite | **731 passed, 1 skipped** (87 ไฟล์, 75.84 s) | `npx vitest run` |
| 4 | Fidelity errors at source | **0 errors in 1,080 instances** across all 11 topics | `engine/benchmarks/results/engine-benchmarks.md:47` |
| 5 | Fine-tune dataset | **1,920 rows, 1,870 usable** (9 topics) | `Documents/jotelab-dataset.csv` |

⚠ **Number 2 takes over nine minutes.** Never run it live in front of judges. Have the
output on screen already, or show `engine/benchmarks/results/engine-benchmarks.md` instead.

---

## 1. เกณฑ์ Technique (10 คะแนน) — the architecture and the invariant

| Claim (as they'd say it) | Verified? | Evidence | Safe unprompted? |
| --- | --- | --- | --- |
| «ทุกตัวเลขที่ผู้ใช้เห็น มาจาก symbolic engine โมเดลภาษาเขียนแค่ข้อความภาษาไทย» | **VERIFIED** | `lib/engine/assemble-question.ts:40` `assembleEngineQuestion` — `given_values`, `steps`, `final_answer` are all read from `sympyData`; `question_text` is the only argument that came from the model | ✅ **นี่คือประโยคหลักของทีม** |
| «โมเดลคืนค่ามาแค่ field เดียว คือ `question_text` จึงไม่มีช่องให้ใส่ตัวเลข» | **VERIFIED** | `lib/ai/generate-engine-question.ts:71–73` — `phrasingSchema = z.object({ question_text: z.string().min(1).max(...) })` | ✅ |
| «หลังจากนั้นเรายังตรวจซ้ำ ว่าตัวเลขในประโยคภาษาไทยตรงกับ engine ทุกตัว» | **VERIFIED** | `lib/ai/data-fidelity.ts:62` `checkDataFidelity` — three rules: ทุก given ต้องปรากฏ, ทุกเลขในประโยคต้องเป็นค่าของ engine, คำตอบต้องไม่ปรากฏ | ✅ |
| «การป้องกันมีสองชั้น: เชิงโครงสร้าง กับ เชิงตรวจสอบ» | **VERIFIED** | โครงสร้าง = `assemble-question.ts:40`; ตรวจสอบ = `data-fidelity.ts:62` | ✅ ตอบคำถาม "รู้ได้ไงว่า AI ไม่แก้เลข" ได้ทั้งหมด |
| «ถ้า engine ล่ม ระบบไม่สร้างโจทย์ และคืนเครดิตให้ผู้ใช้ — เราไม่ fallback ไปใช้เลขจาก LLM» | **VERIFIED** | `features/generate/generate-question-core.ts:169–186` `cancelGenerateReservation` / `cancelRegenerateReservation`; `lib/engine/client.ts` โยน `EngineError` | ✅ นี่คือคำตอบของ "ทำไมต้อง fail-closed" |
| «ถ้า Data Fidelity ไม่ผ่าน ระบบให้โมเดลแก้ครั้งเดียว ถ้ายังไม่ผ่านก็ล้มเลย» | **VERIFIED** | `lib/ai/generate-engine-question.ts:186–205` | ✅ |
| «engine เป็นบริการ Python แยกอีก process แต่ source code อยู่ใน repo เดียวกัน judge เปิดอ่านได้» | **VERIFIED** | `engine/service/app.py`; vendored เป็น git subtree ของ `Jotelab/jotelab-ai` | ✅ |
| «ตัวเลขทุกค่ามีสองรูปแบบ — `exact` แบบไม่สูญเสียความละเอียด และ `value` สำหรับแสดงผล» | **VERIFIED** | payload จริงด้านล่าง; ADR-005; การให้คะแนนใช้ `exact` (`features/coach/oracle.ts` `parseExact`) | ✅ แต่ให้พูดเฉพาะเมื่อถูกถามลึก |
| «engine เป็นคนวาดไดอะแกรมด้วย ไม่ใช่โมเดล» | **VERIFIED** | payload มี field `diagram`; 9 จาก 11 topic ปล่อย diagram payload (`engine/benchmarks/results/engine-benchmarks.md:70`) | ⚠ พูดว่า "9 จาก 11 หัวข้อ" ไม่ใช่ "ทุกหัวข้อ" |

**Reproducible payload** — this is the single most convincing artifact. It reproduces byte-for-byte:

```bash
curl -s -X POST http://127.0.0.1:8000/generate \
  -H 'Content-Type: application/json' -H 'X-Engine-Api-Key: dev-secret' \
  -d '{"topic":"suvat","difficulty":"easy","given":["u","a","t"],"find":"v","seed":424242}'
```

```json
{"topic":"suvat","seed":424242,
 "given":[{"symbol":"a","value":1,"exact":"1","unit":"m/s^2"},
          {"symbol":"t","value":5,"exact":"5","unit":"s"},
          {"symbol":"u","value":0,"exact":"0","unit":"m/s"}],
 "find":{"symbol":"v","value":5,"exact":"5","unit":"m/s"},
 "steps":[{"expr_latex":"v = a t + u","substituted_latex":"v = 0 + 1 \\cdot 5",
           "result_latex":"v = 5\\ \\text{m/s}"}],
 "final_answer":{"value":5,"exact":"5","unit":"m/s","latex":"5\\ \\text{m/s}"}}
```

---

## 2. เกณฑ์ Creativity (20 คะแนน) — the coach

| Claim | Verified? | Evidence | Safe unprompted? |
| --- | --- | --- | --- |
| «`/learn` ไม่เรียกโมเดลภาษาเลย ทำงานออฟไลน์ได้ 100%» | **VERIFIED** | ไม่มี import จาก `lib/ai` ใน `features/coach/` เลย ยกเว้น `e2eStubEngineQuestion` ซึ่งถูกกั้นด้วย `if (process.env.E2E_STUB_GENERATION === "true")` — `features/coach/actions.ts:56` | ✅ **จุดขายที่ปลอดภัยที่สุด** |
| «โจทย์ภาษาไทยใน `/learn` ประกอบขึ้นจาก givens แบบกำหนดตายตัว ไม่ได้ให้ AI เขียน» | **VERIFIED** | `features/coach/oracle.ts` `assembleQuestionText` — ต่อสตริงจาก `givenPhrases` ตรง ๆ | ✅ |
| «คำตอบข้อที่ถูกไม่ได้เก็บไว้ที่ไหน — มันถูก*อนุมาน*จากชุดตัวแปร 3 ให้ 1 หา» | **VERIFIED** | `features/coach/equations.ts:48` `relationForSplit`; bank มี 5 สมการ (`v-uat`, `s-uat`, `v2-uas`, `s-uvt`, `s-vat` — บรรทัด 20–35) | ✅ นี่คือไอเดียที่สวยที่สุดของโปรเจกต์ |
| «ระบบแยกได้ว่านักเรียนผิดเพราะ*ไม่เข้าใจ*หรือแค่*คำนวณพลาด*» | **VERIFIED** | `features/coach/classify.ts` — `checkEquationChoice:40`, `checkSubstitution:59`, `checkAnswer:117` — เรียงจากเฉพาะเจาะจงไปหากว้าง: all-correct → swapped-pair → sign-flip → `value-slip` | ✅ |
| «ระบบวัดตัวเองว่า taxonomy ที่เราตั้งขึ้นใช้ได้จริงไหม ถ้าตกถังรวมเกินครึ่ง ถือว่าใช้ไม่ได้» | **VERIFIED** | `features/coach/taxonomy-evidence.ts:33` `CATCH_ALL_CEILING = 0.5`; verdict `unsupported` เมื่อเกิน (บรรทัด 87–88) | ✅ **ตอบ "creativity" ได้ดีมาก — เป็นคำทำนายที่ล้มเหลวได้** |
| «ระบบเลือกโจทย์ข้อถัดไปจากความผิดพลาดที่วินิจฉัยได้» | **VERIFIED** | `features/coach/remediation.ts` — priority: conceptual miss → sign error → …; ทุกกฎเป็น rule-based | ✅ |
| «ความแม่นยำในการจำแนกความผิดพลาด 100%» | **PARTLY** | `benchmarks/results/coaching-effectiveness.md` — 150/150 = 1.0000 **แต่เป็นข้อมูลที่เขียนสคริปต์ขึ้นเอง (scripted canonical instances, seed 20260729) ไม่ใช่คำตอบนักเรียนจริง** | ⚠ **พูดว่า**: «จำแนกถูก 150 จาก 150 เคสที่เราสร้างขึ้นเป็นตัวแทนของความผิดแต่ละแบบครับ ยังไม่ได้ทดสอบกับนักเรียนจริง» |
| «นักเรียนจริงใช้แล้วดีขึ้น» | **UNVERIFIED** | ไฟล์เดียวกันระบุเอง: "Part (b) … the student pilot … is **not** covered by this run" | ❌ **ห้ามพูด** |

---

## 3. เกณฑ์ Look & Feel (20 คะแนน) และขอบเขต

| Claim | Verified? | Evidence | Safe unprompted? |
| --- | --- | --- | --- |
| «ใบงานครอบคลุม 11 หัวข้อ» | **VERIFIED** | engine `/health` คืน 11 topic; ฝั่งแอปผูกครบ 11 บทเรียน — `lib/engine/topics.ts:152–164` | ✅ |
| «โหมดติวเข้ม (`/learn`) ครอบคลุมเฉพาะ SUVAT หัวข้อเดียว» | **VERIFIED** | `features/coach/oracle.ts:58` `buildCoachProblem` คืน `null` ถ้า split ไม่เข้าสมการทั้ง 5 | ✅ **ต้องพูดเอง ก่อนถูกถาม** |
| «บทเรียนที่ engine ยังไม่รองรับ ยังสร้างใบงานได้ผ่านเส้นทาง LLM เดิม» | **VERIFIED** | `lib/engine/topics.ts:184` `shouldUseEngine` คืน `false` แล้วตกไปเส้นทางเดิม | ⚠ พูดเฉพาะเมื่อถูกถาม — เส้นทางนี้ **ไม่มี** การรับประกันตัวเลข |
| «ไดอะแกรม TikZ คอมไพล์ผ่าน 5/5 แบบ ด้วย TeX engine จริง ไม่ได้ mock» | **VERIFIED** | `benchmarks/results/tikz-compilation-rate.md` — node-tikzjax, 5/5 | ✅ |
| «เราทดสอบ TikZ ที่โมเดลสร้างขึ้น» | **UNVERIFIED** | benchmark ทดสอบ **templated** diagram เท่านั้น; ไฟล์ระบุเอง "LLM-generated TikZ is on the cut list" | ❌ **รายงานเขียนไว้แบบนี้ แต่ของจริงไม่ใช่** — ดู §5 |

---

## 4. เกณฑ์ Economic & Social Impact (20 คะแนน)

| Claim | Verified? | Evidence | Safe unprompted? |
| --- | --- | --- | --- |
| «ครูเสียเวลากับการคำนวณย้อนกลับเพื่อให้ได้ตัวเลขลงตัว» | **PARTLY** | รายงานบรรทัด 57/120 ระบุปัญหานี้ แต่**ไม่มีผลสำรวจครูแนบมา** | ⚠ พูดในฐานะ*เหตุผลที่เริ่มทำ* ไม่ใช่*ผลการวิจัย*: «เราเห็นปัญหานี้จากครูที่โรงเรียนครับ» |
| «`/learn` ใช้ได้โดยไม่ต้องสมัครสมาชิกและไม่ต้องต่อเน็ต» | **VERIFIED** | `docs/demo-runbook.md` §5; ไม่มีการเรียกโมเดล และหน้า `/learn` ไม่ต้อง login | ✅ นี่คือข้อได้เปรียบด้าน impact ที่พิสูจน์ได้สด ๆ |
| «รองรับผู้ใช้พร้อมกันได้กี่คน» | **UNVERIFIED** | ไม่มี load test ใน repo | ❌ **ตอบว่า «ยังไม่ได้ทดสอบครับ»** |
| «ประหยัดต้นทุนกว่า / ถูกกว่าเจ้าอื่น» | **UNVERIFIED** | ไม่มีการวิเคราะห์ต้นทุน | ❌ ห้ามพูดตัวเลข |

---

## 5. ⚠ ช่องว่างระหว่างรายงานกับโค้ด — the hostile-question zone

**อ่านส่วนนี้ให้ครบทุกคน ทุกคนต้องตอบเหมือนกัน**

### 5.1 โมเดลภาษา — the big one

| สิ่งที่รายงานเขียน | สิ่งที่โค้ดทำจริง |
| --- | --- |
| "Fine-tuned Qwen 3.5" — บทคัดย่อไทย (บรรทัด 61), บทคัดย่ออังกฤษ (80), วัตถุประสงค์ (143), เครื่องมือ (193, 418, 419), บรรณานุกรม (575) | `lib/ai/client.ts:21` → `GENERATION_MODEL_ID = "gemini-2.5-flash"`; provider ปริยาย `"google"` (บรรทัด 53–56) |

- คำว่า **"Gemini" ไม่ปรากฏในรายงานแม้แต่ครั้งเดียว** (`grep -c` = 0).
- LoRA fine-tune **ไม่เคยทำเสร็จ** — `DEVELOPMENT_PLAN.md` Phase C2 บรรทัด 141–148: กล่องทั้งสี่ยังไม่ติ๊ก
  (Synthetic dataset / LoRA fine-tune / Serve / Fallback decision).
- ช่องสำหรับ serve โมเดล fine-tune **มีอยู่จริงในโค้ด** (`MODEL_PROVIDER=runpod`, `lib/ai/client.ts:32–49`)
  แต่ต้องตั้งค่า `RUNPOD_BASE_URL` / `RUNPOD_API_KEY` / `RUNPOD_MODEL_ID` ซึ่งไม่ได้ตั้ง — **ไม่มีโมเดลวิ่งผ่านช่องนี้**
- **การตัดสินใจถูกบันทึกไว้แล้ว** — `DEVELOPMENT_PLAN.md` บรรทัด 155–164:

  > **⏰ FALLBACK DECISION — RECORDED 2026-07-29:** no held-out metrics beat (or exist against)
  > the Gemini baseline by the Jul 27 date. … **Gemini ships as the primary provider; the
  > Qwen 3.5 fine-tune is presented in the report as a benchmarked comparison / future work —
  > stated explicitly, not silently.**

**คำตอบที่ซื่อสัตย์คือการตัดสินใจที่บันทึกไว้ ไม่ใช่รายงาน** ดูประโยคที่ต้องท่องใน `cheat-sheet.md`.
**ห้ามพูดคำว่า "Qwen ที่เรา fine-tune แล้ว" เด็ดขาด**

### 5.2 สิ่งที่สาย fine-tune ทำได้จริง — ของจริง อ้างอิงได้

| Claim | Verified? | Evidence |
| --- | --- | --- |
| «เราสร้างชุดข้อมูล 1,920 แถวที่ผ่านการตรวจ fidelity แล้ว» | **PARTLY** | `Documents/jotelab-dataset.csv` — 1,920 แถว, 11 คอลัมน์ **แต่ `status=ok` แค่ 1,870 แถว; อีก 50 แถวเป็น `no_clean_instance`** และครอบคลุม **9** หัวข้อ ไม่ใช่ 11 |
| | | **พูดว่า**: «ชุดข้อมูล 1,920 แถว ใช้ได้จริง 1,870 แถว ครอบคลุม 9 หัวข้อครับ» |
| «มี design spec ของการ fine-tune» | **VERIFIED** | `Documents/2026-07-17-template-authoring-finetune-design.md` |
| «เป้าหมายเดิมคือ ≥ 2,000 คู่» | **VERIFIED** | `DEVELOPMENT_PLAN.md:143` — ทำได้ 1,920 จึง**ต่ำกว่าเป้าเล็กน้อย** ถ้าถูกถามให้ยอมรับตรง ๆ |

⚠ **ไฟล์ชุดข้อมูลอยู่นอก repo** (`Documents/` ที่ระดับ workspace ไม่ใช่ใน `physics-jotelab-local`)
กรรมการที่ clone repo จะไม่เจอ — **เตรียมเปิดไฟล์นี้จากเครื่องเอง**

### 5.3 ตัวชี้วัดในรายงาน 4 ข้อ — อันไหนมีผลจริง

รายงานบรรทัด 492–505 ตั้งตัวชี้วัด 4 ข้อ แต่**รายงานผลจริงแค่ข้อเดียว** และ repo เองระบุว่าอีกสามข้อยังไม่ได้รัน
(`engine/benchmarks/results/engine-benchmarks.md:73` "Not run by this command"):

| # | ตัวชี้วัด | สถานะจริง | ตัวเลขที่พูดได้ |
| --- | --- | --- | --- |
| 1 | Data Fidelity | **ที่ต้นทาง = VERIFIED** / **ปลายทาง (end-to-end) = ยังไม่ได้รัน** (ต้องใช้ LLM key) | «ที่ต้นทาง ไม่มีข้อผิดพลาดเลย 0 จาก 1,080 instance ครับ» |
| 2 | TikZ Compilation Rate | **VERIFIED เฉพาะ templated diagram** 5/5 — ไม่ใช่ TikZ จากโมเดล | «แบบ templated คอมไพล์ผ่าน 5 จาก 5 ครับ» |
| 3 | Schema Adherence | **ยังไม่ได้รัน** (ต้องตั้งค่าทั้งสอง provider) | «ยังไม่ได้วัดครับ» |
| 4 | LLM-as-a-Judge | **ยังไม่ได้รัน** (ต้องใช้ frontier model key + ชุดตัวอย่าง 100 ข้อ) | «ยังไม่ได้วัดครับ» |

### 5.4 "Data Fidelity 100%" — พูดยังไงให้ไม่โกหก

รายงานบรรทัด 494–496 เขียนว่า *"ทดสอบด้วยชุดทดสอบอัตโนมัติ 59 รายการ … ผลลัพธ์ 100%"*

- **"59 รายการ" ไม่สามารถทำซ้ำได้ในวันนี้** — `lib/ai/data-fidelity.test.ts` ปัจจุบันมี **9 tests**
  ชุดทดสอบทั้งระบบมีมากกว่านั้นมาก ตัวเลข 59 น่าจะเป็นค่าที่จริง ณ เวลาที่เขียนรายงาน
  **ถ้ากรรมการถามถึงเลข 59 ให้ตอบว่าเป็นตัวเลขตอนส่งรายงาน และเสนอตัวเลขปัจจุบันแทน**
- **สิ่งที่ทำซ้ำได้และแข็งแรงกว่ามาก** — `engine/benchmarks/results/engine-benchmarks.md:47`:

  | | instances | ok | **fidelity_error** | no_clean_instance | ok rate |
  | --- | ---: | ---: | ---: | ---: | ---: |
  | **TOTAL (11 topics)** | 1,080 | 1,030 | **0** | 50 | 0.9537 |

  **อ่านตารางนี้ให้ถูก:** `fidelity_error = 0` แปลว่า **ไม่มีสักครั้งเดียวที่ตัวเลขที่ engine สร้าง
  ไม่ตรงกับการคำนวณซ้ำอิสระ** ส่วน 50 เคสที่เหลือคือ `no_clean_instance` — engine **ปฏิเสธที่จะออกโจทย์**
  เพราะหาเลขที่ลงตัวไม่ได้ **นั่นคือการปฏิเสธ ไม่ใช่คำตอบผิด**

  ⚠ **ห้ามพูดว่า "ความแม่นยำ 95.37%"** — มันไม่ใช่ความแม่นยำ มันคืออัตราที่ engine ยอมออกโจทย์
  ✅ **ให้พูดว่า** «ข้อผิดพลาดด้านตัวเลข 0 ครั้ง จาก 1,080 ครั้งครับ อีก 50 ครั้งระบบเลือกที่จะไม่ออกโจทย์
  เพราะหาเลขที่ลงตัวไม่ได้ ซึ่งเราถือว่าปลอดภัยกว่าการออกโจทย์ที่เลขไม่สวย»

- **Chain fidelity** — 45/45, `fidelity_error = 0` (บรรทัด 66) สำหรับโจทย์สองต่อ

### 5.5 การอ้างว่าเทียบเท่าครู

| Claim | Verified? | Evidence |
| --- | --- | --- |
| «ระบบตรวจได้เทียบเท่าครู» | **UNVERIFIED** | รายงานบรรทัด 505 เขียนว่า LLM-as-a-Judge "เทียบเท่าการตรวจสอบโดยมนุษย์" — แต่ตัวชี้วัดนี้ **ยังไม่ได้รันเลย** และ**ไม่มีการศึกษาความสอดคล้องกับครู** ไม่มีคณะกรรมการ ไม่มีสถิติ inter-rater |

❌ **ห้ามพูดคำว่า "เทียบเท่าครู" ในทุกรูปแบบ**
✅ ถ้าถูกถาม: «ในรายงานเขียนไว้เป็นความคาดหวังครับ เรายังไม่ได้ทำการศึกษาเทียบกับครูจริง»

หมายเหตุ: **ตัวโค้ชเองไม่ได้อ้างแบบนั้น** — มันตรวจเทียบกับเฉลยของ engine ด้วยกฎธรรมดา และไม่มีโมเดลตัดสินอะไรเลย

### 5.6 Data Fidelity เป็นการรับรองตัวเอง

| Claim | Verified? | Evidence |
| --- | --- | --- |
| «Data Fidelity วัดโดย harness ของเราเอง บน output ของ engine เราเอง» | **VERIFIED** | `engine/harness/verify.py` + `benchmarks/run.py`; ไม่มีบุคคลภายนอกตรวจสอบ |

✅ **ต้องพูดเอง ก่อนถูกถาม** — ดูสคริปต์

### 5.7 §5.4 ของ booklet — การเปิดเผยแหล่งที่มาของโค้ด

Booklet หน้า 29–30 §5.4 กำหนดว่า *"ผู้พัฒนาต้องชี้แจงส่วนสำคัญที่ทีมงาน/ผู้พัฒนาได้พัฒนาขึ้นเอง
รวมทั้งต้องระบุแหล่งที่มาของโปรแกรม หรือ Source Code อื่นที่มาประกอบในโปรแกรม"*

| Claim | Verified? | Evidence |
| --- | --- | --- |
| «รายงานเปิดเผยว่าใช้เครื่องมือ AI ช่วยเขียนโค้ด» | **VERIFIED — รายงานทำแล้ว** | รายงานบรรทัด 397: *"Cursor, Antigravity และ Claude Code — ชุดเครื่องมือ AI-Driven Development (IDE และ AI Agent) สำหรับเขียน ทดสอบ และจัดการโค้ด"* |
| «รายงานระบุชัดว่าส่วนไหนทีมเขียนเอง» | **PARTLY** | รายงานลิสต์เครื่องมือและไลบรารีครบ แต่**ไม่มีย่อหน้าที่บอกตรง ๆ ว่าส่วนไหนคือฝีมือทีม** — ควรพูดเสริมด้วยปากในห้อง |
| «มีโค้ดบางส่วนที่เครื่องมือ AI เขียน» | **VERIFIED** | เช่น `features/coach/remediation.ts` |

✅ **ข่าวดี: รายงานเปิดเผยเครื่องมือไว้แล้ว** ทีมไม่ได้ปิดบัง — แต่ให้พูดย้ำในห้องด้วย

### 5.8 เครื่องมือที่ลิสต์ไว้แต่ไม่ได้ใช้จริง

รายงานบรรทัด 414–418 ลิสต์ **PyTorch, Unsloth, Transformers** ว่าใช้ "ในการฝึกโมเดล"
เนื่องจาก fine-tune ไม่เคยเสร็จ ถ้ากรรมการถามว่า *"ใช้ PyTorch ทำอะไร"*
✅ ตอบ: «ใช้ในสายงาน fine-tune ที่เราทำชุดข้อมูลและสเปกไว้ครับ แต่การเทรนจริงยังไม่ได้ทำ
ตัวที่ใช้ผลิตงานตอนนี้คือ Gemini»
❌ อย่าอธิบายว่าเทรนโมเดลเสร็จแล้ว

---

## 6. ตัวเลขที่ต้องรันใหม่เช้าวันนำเสนอ

| Command | ค่าที่วัดได้ 2026-08-01 | หมายเหตุ |
| --- | --- | --- |
| `curl -s http://127.0.0.1:8000/health` | 11 topics | ⚡ 4 วินาที — **ใช้แสดงสดได้** |
| `cd engine && .venv/bin/python -m pytest -q` | **345 passed, 2 skipped** (รันสองครั้ง: 556.75 s และ 674.58 s) | ⚠ 9–11 นาที — อย่ารันสด |
| `npx vitest run` | **731 passed, 1 skipped** (87 ไฟล์ผ่าน, 1 skipped) ใน **75.84 s** | ⚡ **1 นาทีกว่า — รันสดได้!** |
| `npx vitest run lib/ai/data-fidelity.test.ts` | 9 tests passed | ⚡ เร็วมาก |
| `wc -l Documents/jotelab-dataset.csv` | 1,921 (= 1,920 แถวข้อมูล + header) | |

> **หมายเหตุสำคัญ — อย่ารันชุดทดสอบสองชุดพร้อมกัน**
> ตอนตรวจสอบ เรารัน `npx vitest run` พร้อมกับ `pytest` ผลคือ vitest ค้างจนถูกฆ่าที่ 20 นาที
> (`[vitest-pool]: Timeout terminating forks worker … coach-session.test.tsx`)
> **พอรันเดี่ยว ๆ ผ่านหมดใน 75.84 วินาที** — เป็นปัญหาการแย่ง CPU ไม่ใช่เทสต์เสีย
> ⚠ **ในห้องนำเสนอ ให้รันทีละชุดเท่านั้น** และปิดโปรแกรมอื่นก่อนรัน

---

## 7. ปัญหาด้านการติดตั้ง — กระทบเกณฑ์ "รายงานและการติดตั้งโปรแกรม" (25 คะแนน)

เกณฑ์ข้อนี้มีน้ำหนักสูงสุด และ booklet หน้า 31 ข้อ 3 ระบุว่า
*"คณะกรรมการจะตรวจสอบความเรียบร้อยของผลงาน โดยการทดสอบการติดตั้งและทดลองใช้งานจริงตามคู่มือ"*

| ปัญหา | สถานะ | ผลกระทบ |
| --- | --- | --- |
| **`local-testing` ยังไม่ถูก push ขึ้น GitHub** | ⚠ **VERIFIED — ยังไม่ได้ push** `git ls-remote --heads origin` มี 14 branch และ**ไม่มี `local-testing`** (มีแต่ `master`) | คู่มือ (`docs/demo-runbook.md` §2) สั่งให้ `git clone` แล้ว `git checkout local-testing` — **กรรมการจะทำตามคู่มือแล้วล้มเหลว** |
| **`engine/.venv` ไม่มีในเครื่องนี้** | ⚠ **VERIFIED — ไม่มี** | ต้องสร้างก่อนตามคู่มือ §3 — ทำล่วงหน้า ห้ามติดตั้งต่อหน้ากรรมการ |

🔴 **นี่คือความเสี่ยงที่ใหญ่ที่สุดต่อคะแนน 25 คะแนน** — ต้องแก้ก่อนวันนำเสนอ:
`git push -u origin local-testing` (หรือเตรียม USB ตามที่คู่มือระบุเป็นทางสำรอง)

---

## 8. กติกาที่ตรวจสอบแล้ว

| Claim | Verified? | Evidence |
| --- | --- | --- |
| เกณฑ์หมวด 22 ระดับนักเรียน = รายงานและการติดตั้ง 25 · Look & Feel 20 · Technique 10 · Creativity 20 · Economic & Social Impact 20 · การนำเสนอ 5 = 100 | **VERIFIED** | Booklet หน้า 31–32 |
| ต้องได้ ≥ 60 คะแนน จึงได้รับทุนรอบนำเสนอ; ≥ 80 คะแนน จึงผ่านเข้ารอบชิงชนะเลิศ | **VERIFIED** | Booklet หน้า 32 |
| ผู้พัฒนาต้องมานำเสนอด้วยตนเอง ณ สถานที่ที่ศูนย์ประสานงานภูมิภาคกำหนด | **VERIFIED** | Booklet หน้า 31 ข้อ 1 |
| **booklet ไม่ได้กำหนดเวลานำเสนอ** | **VERIFIED (ไม่มีระบุ)** | หน้า 31 มอบให้ศูนย์ประสานงานภูมิภาคกำหนด "วัน เวลา และสถานที่" — ค้นทั้งเล่มพบคำว่า "นาที" เฉพาะคลิป 7 นาทีของ**รอบชิงชนะเลิศ** เท่านั้น |
| คลิป 7 นาที เป็นข้อกำหนดของ**รอบชิงชนะเลิศ** (online 21 ส.ค. 2569) ไม่ใช่รอบนี้ | **VERIFIED** | Booklet หน้า 32–33 |
| ช่วงตรวจผลงานรอบนำเสนอ = 20 ก.ค. – 6 ส.ค. 2569; ประกาศผล 7 ส.ค. 2569 | **VERIFIED** | Booklet หน้า 13–14 |

📞 **ต้องโทรถามเวลานำเสนอจริง** — ศูนย์ประสานงานภูมิภาคภาคเหนือ มหาวิทยาลัยเชียงใหม่
ผศ. ดร.กานต์ ปทานุคม / ผศ. ดร.อัญญา อาภาวัชรุตม์ · โทร 0 5394 2023 ·
karn@eng.cmu.ac.th, anya@eng.cmu.ac.th, northernNSC@gmail.com

---

## 9. สิ่งที่ตรวจสอบไม่ได้ และเหตุผล

| สิ่งที่ตรวจไม่ได้ | เหตุผล |
| --- | --- |
| **เวลานำเสนอจริง** | booklet ไม่ระบุ — มอบให้ศูนย์ภูมิภาคกำหนด สคริปต์จึงสร้างเป็นแกน 10 นาที พร้อมรุ่นตัด 5 นาที และรุ่นขยาย 15 นาที |
| **Data Fidelity แบบ end-to-end** | ต้องใช้ LLM provider key ซึ่งไม่มีในเครื่องนี้ — repo ระบุเองว่ายังไม่ได้รัน |
| **Schema Adherence / LLM-as-a-Judge** | ต้องใช้ key ของสอง provider และชุดตัวอย่าง 100 ข้อ — ยังไม่ได้รัน |
| **การทำงานจริงของหน้า `/learn` ในเบราว์เซอร์** | ไม่ได้เปิดแอปขึ้นมาจริง — ตรวจจากโค้ดและเส้นทางการเรียกเท่านั้น **ทีมต้องเดินตาม pre-flight checklist ใน `docs/demo-runbook.md` §7 ด้วยตัวเอง** |
| **ตัวเลข "59 การทดสอบ" ในรายงาน** | ทำซ้ำไม่ได้ ณ HEAD ปัจจุบัน |
| **การสำรวจครู / ข้อมูลผู้ใช้จริง** | ไม่มีในโปรเจกต์ |
| **จำนวนผู้ใช้พร้อมกัน** | ไม่มี load test |

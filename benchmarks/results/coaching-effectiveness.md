# Coaching Effectiveness — classification accuracy (DEVELOPMENT_PLAN C4)

Scripted wrong-step submissions per error type: 25 (seed 20260729).
Each submission is a canonical instance of its error, checked by the same
rule-based classifier the coach uses (`features/coach/classify.ts`).
Deterministic — rerunning reproduces this file exactly.

| error type | scripted | classified correctly | accuracy |
| --- | ---: | ---: | ---: |
| wrong-equation | 25 | 25 | 1.0000 |
| swapped-variables | 25 | 25 | 1.0000 |
| sign-error | 25 | 25 | 1.0000 |
| unit-slip | 25 | 25 | 1.0000 |
| arithmetic-slip | 25 | 25 | 1.0000 |
| value-slip | 25 | 25 | 1.0000 |
| **overall** | 150 | 150 | 1.0000 |

Part (b) of this metric — the student pilot (solved-after-hint rate) — is
a human study and is **not** covered by this run.

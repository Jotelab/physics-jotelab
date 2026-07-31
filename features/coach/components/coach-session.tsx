"use client"

import "katex/dist/katex.min.css"

import { useMemo, useState, useTransition } from "react"
import { BlockMath, InlineMath } from "react-katex"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TikzDiagram } from "@/features/worksheet/components/tikz-diagram"
import { cn } from "@/lib/utils"
import { SUVAT } from "@/lib/engine/topics"
import type { SympyData } from "@/lib/engine/sympy-data"

import { generateCoachProblem } from "../actions"
import { recordAttempt, setAttemptTransport } from "../attempt-log"
import { persistAttempt } from "../persist-attempt"
import {
  checkAnswer,
  checkEquationChoice,
  checkSubstitution,
  parseStudentNumber,
} from "../classify"
import {
  ERROR_LABELS,
  EXPLANATIONS,
  hintLevelForAttempt,
  NUDGES,
  WORKED_LABELS,
  type HintLevel,
} from "../explanations"
import { buildCoachProblem, questionKey } from "../oracle"
import { planNextProblem } from "../remediation"
import type {
  CheckResult,
  CoachDifficulty,
  CoachErrorType,
  CoachStep,
} from "../types"

/**
 * The coached solve (C1.1): ① choose the equation → ② substitute values →
 * ③ compute the answer. Every check runs against the engine's verified
 * solution (`sympy_data`); wrong answers escalate nudge → targeted
 * micro-explanation → worked step, then offer an isomorphic re-roll.
 */

// Signed-in students' attempts persist to `coaching_attempts`; anonymous
// solves degrade to the console mirror inside recordAttempt (C1.3).
setAttemptTransport(persistAttempt)

type StepState = {
  attempts: number
  hint: { level: HintLevel; text: string } | null
  done: boolean
}

const FRESH_STEP: StepState = { attempts: 0, hint: null, done: false }

const STEP_ORDER: CoachStep[] = ["equation", "substitution", "answer"]

const STEP_TITLES: Record<CoachStep, string> = {
  equation: "① เลือกสมการที่ใช้แก้โจทย์ข้อนี้",
  substitution: "② แทนค่าที่โจทย์กำหนดให้",
  answer: "③ คำนวณหาคำตอบ",
}

export function CoachSession({
  initial,
  initialDiagramSvg = null,
}: {
  initial: SympyData
  /** Templated motion diagram for `initial` (compiled server-side), if any. */
  initialDiagramSvg?: string | null
}) {
  const [sympyData, setSympyData] = useState(initial)
  const [diagramSvg, setDiagramSvg] = useState(initialDiagramSvg)
  const [steps, setSteps] = useState<Record<CoachStep, StepState>>({
    equation: FRESH_STEP,
    substitution: FRESH_STEP,
    answer: FRESH_STEP,
  })
  const [chosenEquation, setChosenEquation] = useState<string | null>(null)
  const [substitutions, setSubstitutions] = useState<Record<string, string>>({})
  const [answerInput, setAnswerInput] = useState("")
  const [rerollError, setRerollError] = useState<string | null>(null)
  const [isRerolling, startReroll] = useTransition()
  /** Band the *current* problem was generated at; the planner steps it. */
  const [difficulty, setDifficulty] = useState<CoachDifficulty>("easy")
  /** Every misconception the classifier named on this problem, in order. */
  const [problemErrors, setProblemErrors] = useState<CoachErrorType[]>([])
  const [completed, setCompleted] = useState(0)

  const problem = useMemo(() => buildCoachProblem(sympyData, SUVAT), [sympyData])

  if (!problem) {
    // Defensive: the server action refuses uncoachable splits before we get here.
    return (
      <p className="text-sm text-muted-foreground">
        โจทย์ข้อนี้ยังไม่รองรับการฝึกทีละขั้น กรุณาลองสร้างโจทย์ใหม่
      </p>
    )
  }

  const currentStep = STEP_ORDER.find((step) => !steps[step].done) ?? null
  const solved = currentStep === null

  const currentSplit = {
    given: sympyData.given.map((given) => given.symbol),
    find: sympyData.find.symbol,
  }

  /**
   * What the app serves next, and why — chosen from the misconceptions the
   * classifier named on this problem (see `remediation.ts`). The plan is
   * recomputed as the student works, but only shown once the problem is solved.
   */
  const nextPlan = planNextProblem({
    errors: problemErrors,
    given: currentSplit.given,
    find: currentSplit.find,
    difficulty,
    completed,
  })

  /** Distinct diagnoses on this problem, for the end-of-problem summary chip. */
  const diagnosedErrors = [...new Set(problemErrors)]

  function applyResult(step: CoachStep, result: CheckResult, input: string) {
    const attempts = steps[step].attempts + 1
    recordAttempt({
      questionKey: questionKey(sympyData),
      step,
      input,
      errorType: result.ok ? null : result.errorType,
      hintsUsed: result.ok ? attempts - 1 : attempts,
      solved: result.ok,
    })
    if (result.ok) {
      setSteps((prev) => ({ ...prev, [step]: { ...prev[step], attempts, done: true, hint: null } }))
      // The answer step closing means the whole problem is solved.
      if (step === "answer") setCompleted((prev) => prev + 1)
      return
    }
    // Remediation reads this: what was diagnosed decides what comes next.
    setProblemErrors((prev) => [...prev, result.errorType])
    const level = hintLevelForAttempt(attempts)
    const text =
      level === "nudge" ? NUDGES[step] : EXPLANATIONS[result.errorType]
    setSteps((prev) => ({
      ...prev,
      [step]: { attempts, done: false, hint: { level, text } },
    }))
  }

  function submitEquation() {
    if (!problem || !chosenEquation) return
    applyResult(
      "equation",
      checkEquationChoice(chosenEquation, problem.correctEquationId),
      chosenEquation
    )
  }

  function submitSubstitution() {
    if (!problem) return
    const entries = problem.substitutionFields.map((field) => ({
      symbol: field.symbol,
      value: parseStudentNumber(substitutions[field.symbol] ?? ""),
    }))
    if (entries.some((entry) => entry.value === null)) return
    applyResult(
      "substitution",
      checkSubstitution(
        entries.map((entry) => ({ symbol: entry.symbol, value: entry.value! })),
        problem.substitutionFields.map((field) => ({
          symbol: field.symbol,
          value: field.value,
        }))
      ),
      JSON.stringify(substitutions)
    )
  }

  function submitAnswer() {
    if (!problem) return
    const value = parseStudentNumber(answerInput)
    if (value === null) return
    applyResult("answer", checkAnswer(value, problem.answer.value), answerInput)
  }

  function loadProblem(params: {
    given?: string[]
    find?: string
    difficulty: CoachDifficulty
    conditions?: Record<string, number>
  }) {
    setRerollError(null)
    startReroll(async () => {
      const result = await generateCoachProblem(params)
      if (!result.ok) {
        // No silent fallback to an easier problem: the manual re-roll buttons
        // stay on screen, so a failed drill is visible rather than papered over.
        setRerollError(result.error)
        return
      }
      setSympyData(result.sympyData)
      setDiagramSvg(result.diagramSvg)
      setDifficulty(params.difficulty)
      setProblemErrors([])
      setSteps({ equation: FRESH_STEP, substitution: FRESH_STEP, answer: FRESH_STEP })
      setChosenEquation(null)
      setSubstitutions({})
      setAnswerInput("")
    })
  }

  function reroll(isomorphic: boolean) {
    loadProblem(isomorphic ? { ...currentSplit, difficulty } : { difficulty })
  }

  const workedStep = (step: CoachStep) => (
    <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
      <p className="mb-1 text-sm font-medium">{WORKED_LABELS[step]}</p>
      <BlockMath
        math={
          step === "equation"
            ? problem.workedStep.exprLatex
            : step === "substitution"
              ? problem.workedStep.substitutedLatex
              : problem.workedStep.resultLatex
        }
      />
      <Button size="sm" variant="outline" onClick={() => reroll(true)} disabled={isRerolling}>
        ลองโจทย์แบบเดียวกันข้อใหม่
      </Button>
    </div>
  )

  const hintPanel = (step: CoachStep) => {
    const hint = steps[step].hint
    if (!hint) return null
    return (
      <div role="status" className="mt-3 space-y-1">
        <p
          className={cn(
            "rounded-md p-3 text-sm",
            hint.level === "nudge" && "bg-muted text-muted-foreground",
            hint.level !== "nudge" && "border border-amber-400/50 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          )}
        >
          {hint.text}
        </p>
        {hint.level === "worked" ? workedStep(step) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">โจทย์</h2>
        <p className="text-base leading-relaxed">{problem.questionText}</p>
        {diagramSvg ? (
          <TikzDiagram svg={diagramSvg} label="แผนภาพประกอบโจทย์" className="mt-3" />
        ) : null}
      </section>

      {/* Step ① — equation MCQ */}
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="mb-3 font-medium">{STEP_TITLES.equation}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {problem.equationOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={steps.equation.done}
              onClick={() => setChosenEquation(option.id)}
              className={cn(
                "rounded-md border p-3 text-left transition-colors",
                chosenEquation === option.id
                  ? "border-primary bg-primary/10"
                  : "hover:bg-muted",
                steps.equation.done &&
                  option.id === problem.correctEquationId &&
                  "border-primary bg-primary/10"
              )}
            >
              <InlineMath math={option.latex} />
            </button>
          ))}
        </div>
        {!steps.equation.done ? (
          <Button className="mt-3" onClick={submitEquation} disabled={!chosenEquation}>
            ตรวจสมการ
          </Button>
        ) : (
          <p className="mt-3 text-sm text-primary">✓ ถูกต้อง</p>
        )}
        {hintPanel("equation")}
      </section>

      {/* Step ② — substitution */}
      {steps.equation.done ? (
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-medium">{STEP_TITLES.substitution}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {problem.substitutionFields.map((field) => (
              <div key={field.symbol} className="space-y-1">
                <Label htmlFor={`sub-${field.symbol}`}>
                  {field.label} ({field.displaySymbol})
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`sub-${field.symbol}`}
                    inputMode="decimal"
                    value={substitutions[field.symbol] ?? ""}
                    disabled={steps.substitution.done}
                    onChange={(event) =>
                      setSubstitutions((prev) => ({
                        ...prev,
                        [field.symbol]: event.target.value,
                      }))
                    }
                  />
                  <span className="whitespace-nowrap text-sm text-muted-foreground">
                    {field.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {!steps.substitution.done ? (
            <Button
              className="mt-3"
              onClick={submitSubstitution}
              disabled={problem.substitutionFields.some(
                (field) => parseStudentNumber(substitutions[field.symbol] ?? "") === null
              )}
            >
              ตรวจการแทนค่า
            </Button>
          ) : (
            <p className="mt-3 text-sm text-primary">✓ ถูกต้อง</p>
          )}
          {hintPanel("substitution")}
        </section>
      ) : null}

      {/* Step ③ — answer */}
      {steps.substitution.done ? (
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-medium">{STEP_TITLES.answer}</h3>
          <div className="flex max-w-xs items-center gap-2">
            <Label htmlFor="coach-answer" className="whitespace-nowrap">
              {problem.find.label} ({problem.find.displaySymbol}) =
            </Label>
            <Input
              id="coach-answer"
              inputMode="decimal"
              value={answerInput}
              disabled={steps.answer.done}
              onChange={(event) => setAnswerInput(event.target.value)}
            />
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              {problem.answer.unit}
            </span>
          </div>
          {!steps.answer.done ? (
            <Button
              className="mt-3"
              onClick={submitAnswer}
              disabled={parseStudentNumber(answerInput) === null}
            >
              ตรวจคำตอบ
            </Button>
          ) : null}
          {hintPanel("answer")}
        </section>
      ) : null}

      {/* Solved — worked solution + next problem */}
      {solved ? (
        <section className="rounded-lg border border-primary/40 bg-primary/5 p-4">
          <h3 className="mb-2 font-medium text-primary">🎉 ถูกต้องครบทุกขั้น</h3>
          <div className="space-y-1">
            <BlockMath math={problem.workedStep.exprLatex} />
            <BlockMath math={problem.workedStep.substitutedLatex} />
            <BlockMath math={problem.workedStep.resultLatex} />
          </div>
          {diagnosedErrors.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">จุดที่ระบบตรวจพบในข้อนี้:</span>
              {diagnosedErrors.map((errorType) => (
                <span
                  key={errorType}
                  className="rounded-full border border-amber-400/50 bg-amber-50 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  {ERROR_LABELS[errorType]}
                </span>
              ))}
            </div>
          ) : null}

          {/* The remediation loop: the diagnosis above picks the next problem. */}
          <div className="mt-4 rounded-md border border-primary/30 bg-background/60 p-3">
            <p className="text-sm font-medium">ขั้นต่อไปที่แนะนำ</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{nextPlan.reason}</p>
            <Button
              className="mt-3"
              onClick={() => loadProblem(nextPlan.params)}
              disabled={isRerolling}
            >
              ฝึกต่อ
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => reroll(true)} disabled={isRerolling}>
              โจทย์แบบเดียวกันข้อใหม่
            </Button>
            <Button variant="outline" onClick={() => reroll(false)} disabled={isRerolling}>
              โจทย์ใหม่
            </Button>
          </div>
        </section>
      ) : null}

      {rerollError ? (
        <p className="text-sm text-destructive">
          สร้างโจทย์ใหม่ไม่สำเร็จ: {rerollError}
        </p>
      ) : null}
    </div>
  )
}

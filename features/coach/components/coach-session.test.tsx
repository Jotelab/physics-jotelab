import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { e2eStubEngineQuestion } from "@/lib/ai/e2e-stub-question"
import { sympyDataSchema } from "@/lib/engine/sympy-data"
import { SUVAT } from "@/lib/engine/topics"

vi.mock("react-katex", () => ({
  InlineMath: ({ math }: { math: string }) => <span>{math}</span>,
  BlockMath: ({ math }: { math: string }) => <div>{math}</div>,
}))

vi.mock("../actions", () => ({ generateCoachProblem: vi.fn() }))
vi.mock("../attempt-log", () => ({
  recordAttempt: vi.fn(),
  setAttemptTransport: vi.fn(),
}))
vi.mock("../persist-attempt", () => ({ persistAttempt: vi.fn() }))

import { generateCoachProblem } from "../actions"
import { buildCoachProblem } from "../oracle"
import { CoachSession } from "./coach-session"

const stubSympy = sympyDataSchema.parse(e2eStubEngineQuestion.sympy_data)

// Minimal markup that passes sanitizeSvg untouched (see sanitize-svg.test.ts).
const DIAGRAM_A = '<svg viewBox="0 0 10 10"><path d="M0 0L10 10" stroke="#000"/></svg>'
const DIAGRAM_B = '<svg viewBox="0 0 20 20"><path d="M0 0L20 20" stroke="#000"/></svg>'

describe("CoachSession motion diagram", () => {
  it("renders the diagram alongside the problem statement", () => {
    render(<CoachSession initial={stubSympy} initialDiagramSvg={DIAGRAM_A} />)

    const figure = screen.getByRole("img", { name: "แผนภาพประกอบโจทย์" })
    expect(figure.innerHTML).toContain('viewBox="0 0 10 10"')
  })

  it("renders no diagram figure when the problem has none", () => {
    render(<CoachSession initial={stubSympy} initialDiagramSvg={null} />)

    expect(screen.queryByRole("img")).toBeNull()
  })

  it("swaps the diagram when a re-roll returns a new problem", async () => {
    const user = userEvent.setup()
    const problem = buildCoachProblem(stubSympy, SUVAT)
    expect(problem).not.toBeNull()
    if (!problem) return

    vi.mocked(generateCoachProblem).mockResolvedValue({
      ok: true,
      sympyData: stubSympy,
      diagramSvg: DIAGRAM_B,
    })

    render(<CoachSession initial={stubSympy} initialDiagramSvg={DIAGRAM_A} />)

    // ① pick the correct equation
    const correctLatex = problem.equationOptions.find(
      (option) => option.id === problem.correctEquationId
    )!.latex
    await user.click(screen.getByRole("button", { name: correctLatex }))
    await user.click(screen.getByRole("button", { name: "ตรวจสมการ" }))

    // ② substitute the given values
    for (const field of problem.substitutionFields) {
      await user.type(
        screen.getByLabelText(new RegExp(field.label)),
        String(field.value)
      )
    }
    await user.click(screen.getByRole("button", { name: "ตรวจการแทนค่า" }))

    // ③ answer, then re-roll a fresh problem
    await user.type(
      screen.getByLabelText(new RegExp(problem.find.label)),
      String(problem.answer.value)
    )
    await user.click(screen.getByRole("button", { name: "ตรวจคำตอบ" }))
    await user.click(screen.getByRole("button", { name: "โจทย์ใหม่" }))

    const figure = await screen.findByRole("img", { name: "แผนภาพประกอบโจทย์" })
    expect(figure.innerHTML).toContain('viewBox="0 0 20 20"')
  })
})

/**
 * The remediation loop (C1.2 → C1.1): what the classifier diagnosed decides
 * which problem the engine is asked for next.
 */
describe("CoachSession remediation", () => {
  const problem = buildCoachProblem(stubSympy, SUVAT)!

  /** Walk the three steps; `wrongAnswerFirst` plants one classified miss. */
  async function solve(
    user: ReturnType<typeof userEvent.setup>,
    { wrongAnswerFirst }: { wrongAnswerFirst?: number } = {}
  ) {
    const correctLatex = problem.equationOptions.find(
      (option) => option.id === problem.correctEquationId
    )!.latex
    await user.click(screen.getByRole("button", { name: correctLatex }))
    await user.click(screen.getByRole("button", { name: "ตรวจสมการ" }))

    for (const field of problem.substitutionFields) {
      await user.type(
        screen.getByLabelText(new RegExp(field.label)),
        String(field.value)
      )
    }
    await user.click(screen.getByRole("button", { name: "ตรวจการแทนค่า" }))

    const answerField = screen.getByLabelText(new RegExp(problem.find.label))
    if (wrongAnswerFirst !== undefined) {
      await user.type(answerField, String(wrongAnswerFirst))
      await user.click(screen.getByRole("button", { name: "ตรวจคำตอบ" }))
      await user.clear(answerField)
    }
    await user.type(answerField, String(problem.answer.value))
    await user.click(screen.getByRole("button", { name: "ตรวจคำตอบ" }))
  }

  it("advances the difficulty band after a clean solve", async () => {
    const user = userEvent.setup()
    vi.mocked(generateCoachProblem).mockResolvedValue({
      ok: true,
      sympyData: stubSympy,
      diagramSvg: null,
    })
    render(<CoachSession initial={stubSympy} initialDiagramSvg={null} />)

    await solve(user)
    await user.click(screen.getByRole("button", { name: "ฝึกต่อ" }))

    expect(generateCoachProblem).toHaveBeenCalledWith(
      expect.objectContaining({ difficulty: "medium" })
    )
    expect(vi.mocked(generateCoachProblem).mock.calls.at(-1)![0]).not.toHaveProperty(
      "conditions"
    )
  })

  it("names the misconception it diagnosed", async () => {
    const user = userEvent.setup()
    render(<CoachSession initial={stubSympy} initialDiagramSvg={null} />)

    // The stub's answer is +10 m/s, so -10 is a textbook sign flip.
    await solve(user, { wrongAnswerFirst: -problem.answer.value })

    expect(screen.getByText("เครื่องหมายผิด")).toBeInTheDocument()
  })

  it("serves a forced-negative drill after a sign error", async () => {
    const user = userEvent.setup()
    vi.mocked(generateCoachProblem).mockResolvedValue({
      ok: true,
      sympyData: stubSympy,
      diagramSvg: null,
    })
    render(<CoachSession initial={stubSympy} initialDiagramSvg={null} />)

    await solve(user, { wrongAnswerFirst: -problem.answer.value })
    await user.click(screen.getByRole("button", { name: "ฝึกต่อ" }))

    const params = vi.mocked(generateCoachProblem).mock.calls.at(-1)![0]!
    expect(params.conditions?.a).toBeLessThan(0)
    expect(params.given).toContain("a")
    // A drill must not skip the band the student just stumbled on.
    expect(params.difficulty).toBe("easy")
  })

  it("surfaces an engine failure instead of silently serving something easier", async () => {
    const user = userEvent.setup()
    vi.mocked(generateCoachProblem).mockResolvedValue({
      ok: false,
      error: "Engine /generate failed (503)",
    })
    render(<CoachSession initial={stubSympy} initialDiagramSvg={null} />)

    await solve(user)
    await user.click(screen.getByRole("button", { name: "ฝึกต่อ" }))

    expect(
      await screen.findByText(/Engine \/generate failed \(503\)/)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "โจทย์ใหม่" })).toBeInTheDocument()
  })
})

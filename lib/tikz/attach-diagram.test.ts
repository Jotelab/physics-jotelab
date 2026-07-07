import { beforeEach, describe, expect, it, vi } from "vitest"

import type { WorksheetQuestion } from "@/features/generate/types"
import type { SympyData } from "@/lib/engine/sympy-data"
import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

import {
  attachQuestionDiagram,
  attachQuestionDiagrams,
  clearDiagramCacheForTests,
} from "./attach-diagram"

function sympyData(givenSymbols: string[], findSymbol: string): SympyData {
  return {
    topic: "suvat",
    seed: 1,
    given: givenSymbols.map((symbol) => ({ symbol, value: 1, exact: "1", unit: "m/s" })),
    find: { symbol: findSymbol, value: 2, exact: "2", unit: "m/s" },
    steps: [{ expr_latex: "a", substituted_latex: "b", result_latex: "c" }],
    final_answer: { value: 2, exact: "2", unit: "m/s", latex: "2" },
    policy_applied: "easy",
    plausible: true,
  }
}

function question(data: SympyData | undefined): WorksheetQuestion {
  return { ...validWorksheetQuestion, sympy_data: data }
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {})
  clearDiagramCacheForTests()
})

describe("attachQuestionDiagram", () => {
  it("compiles the templated diagram and attaches tikz_code + diagram_svg", async () => {
    const compile = vi.fn(async () => "<svg>ok</svg>")
    const result = await attachQuestionDiagram(question(sympyData(["u", "a", "t"], "v")), {
      compile,
    })

    expect(compile).toHaveBeenCalledOnce()
    expect(result.diagram_svg).toBe("<svg>ok</svg>")
    expect(result.tikz_code).toContain("\\begin{tikzpicture}")
  })

  it("leaves a question without sympy_data untouched", async () => {
    const compile = vi.fn()
    const result = await attachQuestionDiagram(question(undefined), { compile })

    expect(compile).not.toHaveBeenCalled()
    expect(result.diagram_svg).toBeUndefined()
    expect(result.tikz_code).toBeUndefined()
  })

  it("does not recompile when the question already has a diagram", async () => {
    const compile = vi.fn()
    const withDiagram: WorksheetQuestion = {
      ...question(sympyData(["v", "a", "s"], "u")),
      diagram_svg: "<svg>existing</svg>",
    }
    const result = await attachQuestionDiagram(withDiagram, { compile })

    expect(compile).not.toHaveBeenCalled()
    expect(result.diagram_svg).toBe("<svg>existing</svg>")
  })

  it("caches by TikZ source so an identical diagram compiles once", async () => {
    const compile = vi.fn(async () => "<svg>cached</svg>")
    const data = sympyData(["u", "v", "s"], "t")

    const first = await attachQuestionDiagram(question(data), { compile })
    const second = await attachQuestionDiagram(question(data), { compile })

    expect(compile).toHaveBeenCalledOnce()
    expect(first.diagram_svg).toBe("<svg>cached</svg>")
    expect(second.diagram_svg).toBe("<svg>cached</svg>")
  })

  it("dedupes concurrent compiles of the same TikZ source", async () => {
    let resolveCompile: ((svg: string) => void) | undefined
    const compile = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveCompile = resolve
        })
    )
    const data = sympyData(["a", "t", "s"], "u")

    const first = attachQuestionDiagram(question(data), { compile })
    const second = attachQuestionDiagram(question(data), { compile })
    resolveCompile?.("<svg>shared</svg>")
    const [a, b] = await Promise.all([first, second])

    expect(compile).toHaveBeenCalledOnce()
    expect(a.diagram_svg).toBe("<svg>shared</svg>")
    expect(b.diagram_svg).toBe("<svg>shared</svg>")
  })

  it("does not cache a failed compile: the next read retries", async () => {
    const compile = vi
      .fn<(code: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error("tex boom"))
      .mockResolvedValueOnce("<svg>recovered</svg>")
    const data = sympyData(["u", "a", "v"], "s")

    const failed = await attachQuestionDiagram(question(data), { compile })
    const retried = await attachQuestionDiagram(question(data), { compile })

    expect(compile).toHaveBeenCalledTimes(2)
    expect(failed.diagram_svg).toBeUndefined()
    expect(retried.diagram_svg).toBe("<svg>recovered</svg>")
  })

  it("fails soft on a compile error: keeps tikz_code, no diagram_svg", async () => {
    const compile = vi.fn(async () => {
      throw new Error("tex boom")
    })
    const result = await attachQuestionDiagram(question(sympyData(["s", "a", "t"], "v")), {
      compile,
    })

    expect(result.tikz_code).toContain("\\begin{tikzpicture}")
    expect(result.diagram_svg).toBeUndefined()
  })
})

describe("attachQuestionDiagrams", () => {
  it("attaches diagrams across a list", async () => {
    const compile = vi.fn(async () => "<svg>list</svg>")
    const results = await attachQuestionDiagrams(
      [question(sympyData(["u", "a", "s"], "v")), question(undefined)],
      { compile }
    )

    expect(results[0]!.diagram_svg).toBe("<svg>list</svg>")
    expect(results[1]!.diagram_svg).toBeUndefined()
  })
})

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

vi.mock("react-katex", () => ({
  InlineMath: ({ math }: { math: string }) => <span data-testid="inline-math">{math}</span>,
  BlockMath: ({ math }: { math: string }) => <div data-testid="block-math">{math}</div>,
}))

vi.mock("@/features/worksheet/hooks/use-worksheet-pagination", () => ({
  useWorksheetPagination: (displayItems: { length: number }[]) => ({
    measureItemsRef: { current: null },
    headerMeasureRef: { current: null },
    setItemMeasureRef: vi.fn(),
    isHeaderDirty: false,
    isItemDirty: () => true,
    pageItemIndices:
      displayItems.length === 0
        ? []
        : [Array.from({ length: displayItems.length }, (_, index) => index)],
    overflowPageIndices: [],
    measureContentWidthStyle: { width: "174mm" },
  }),
}))

import { DEFAULT_HEADER_FIELDS } from "@/features/worksheet/types/header"

import { MathText, WorksheetPreview } from "./worksheet-preview"

function previewHeader(title: string, instructions: string) {
  return {
    title,
    instructions,
    fields: DEFAULT_HEADER_FIELDS,
  }
}

function getWorksheetPages() {
  return within(screen.getByTestId("worksheet-pages"))
}

describe("WorksheetPreview", () => {
  it("shows the empty state when there are no questions", () => {
    render(
      <WorksheetPreview
        header={previewHeader("Physics: Motion", "5 questions")}
        questions={[]}
        viewMode="worksheet"
        emptyMessage="Nothing generated yet."
      />
    )

    expect(screen.getByText("Nothing generated yet.")).toBeInTheDocument()
    expect(screen.getByText("Worksheet")).toBeInTheDocument()
  })

  it("renders editable header fields in the empty preview", () => {
    render(
      <WorksheetPreview
        header={{
          title: "Physics: Motion",
          instructions: "5 questions",
          fields: { ...DEFAULT_HEADER_FIELDS, showStudentName: true },
        }}
        onHeaderChange={{
          onTitleChange: vi.fn(),
          onInstructionsChange: vi.fn(),
          onFieldsChange: vi.fn(),
        }}
        questions={[]}
        viewMode="worksheet"
        emptyMessage="Nothing generated yet."
      />
    )

    expect(screen.getByText("Name:")).toBeInTheDocument()
  })

  it("renders worksheet mode without the solution block", () => {
    render(
      <WorksheetPreview
        header={previewHeader("Physics: Motion", "1 question")}
        questions={[validWorksheetQuestion]}
        viewMode="worksheet"
      />
    )

    const pages = getWorksheetPages()
    expect(pages.getByText("จงหาค่า", { exact: false })).toBeInTheDocument()
    expect(pages.getByTestId("inline-math")).toHaveTextContent("x")
    expect(pages.queryByText("Solution")).not.toBeInTheDocument()
  })

  it("renders answer key mode with solution steps", () => {
    render(
      <WorksheetPreview
        header={previewHeader("Physics: Motion", "1 question")}
        questions={[validWorksheetQuestion]}
        viewMode="answer"
      />
    )

    const pages = getWorksheetPages()
    expect(pages.getByText("Answer Key")).toBeInTheDocument()
    expect(pages.getByText("Solution")).toBeInTheDocument()
    expect(pages.getByText(validWorksheetQuestion.solution.steps[0])).toBeInTheDocument()
  })

  it("renders a diagram block when the question carries a compiled SVG", () => {
    render(
      <WorksheetPreview
        header={previewHeader("Physics: Motion", "1 question")}
        questions={[
          {
            ...validWorksheetQuestion,
            diagram_svg: '<svg data-testid="tikz-svg"><path d="M0 0L1 1"/></svg>',
          },
        ]}
        viewMode="worksheet"
      />
    )

    const figure = getWorksheetPages().getByRole("img", {
      name: "Diagram for question 1",
    })
    expect(figure).toBeInTheDocument()
    expect(figure.querySelector("svg")).not.toBeNull()
  })

  it("renders no diagram block when the question has no compiled SVG", () => {
    render(
      <WorksheetPreview
        header={previewHeader("Physics: Motion", "1 question")}
        questions={[validWorksheetQuestion]}
        viewMode="worksheet"
      />
    )

    expect(
      getWorksheetPages().queryByRole("img", { name: "Diagram for question 1" })
    ).not.toBeInTheDocument()
  })

  it("renders skipped slots", () => {
    render(
      <WorksheetPreview
        header={previewHeader("Physics: Motion", "2 questions")}
        questions={[validWorksheetQuestion]}
        skippedSlots={[{ order: 2, message: "Question 2 was skipped." }]}
        viewMode="worksheet"
      />
    )

    expect(getWorksheetPages().getByText("Question 2 was skipped.")).toBeInTheDocument()
  })

  it("opens the question action menu", async () => {
    const user = userEvent.setup()
    const onToggleMenu = vi.fn()
    const onEdit = vi.fn()

    render(
      <WorksheetPreview
        header={previewHeader("Physics: Motion", "1 question")}
        questions={[validWorksheetQuestion]}
        viewMode="worksheet"
        questionActions={{
          actionsDisabled: false,
          busyQuestionId: null,
          openMenuQuestionId: validWorksheetQuestion.id,
          onToggleMenu,
          onEdit,
          onRegenerate: vi.fn(),
        }}
      />
    )

    await user.click(screen.getByRole("button", { name: "Question 1 actions" }))
    expect(onToggleMenu).toHaveBeenCalledWith(validWorksheetQuestion.id)

    await user.click(screen.getByRole("button", { name: "Edit (Free)" }))
    expect(onEdit).toHaveBeenCalledWith(validWorksheetQuestion)
  })

  it("shows a busy message for the updating question", () => {
    render(
      <WorksheetPreview
        header={previewHeader("Physics: Motion", "1 question")}
        questions={[validWorksheetQuestion]}
        viewMode="worksheet"
        questionActions={{
          actionsDisabled: false,
          busyQuestionId: validWorksheetQuestion.id,
          openMenuQuestionId: null,
          onToggleMenu: vi.fn(),
          onEdit: vi.fn(),
          onRegenerate: vi.fn(),
        }}
      />
    )

    expect(getWorksheetPages().getByText("Updating question...")).toBeInTheDocument()
  })

  it("calls onRegenerate from the action menu", async () => {
    const user = userEvent.setup()
    const onRegenerate = vi.fn()

    render(
      <WorksheetPreview
        header={previewHeader("Physics: Motion", "1 question")}
        questions={[validWorksheetQuestion]}
        viewMode="worksheet"
        questionActions={{
          actionsDisabled: false,
          busyQuestionId: null,
          openMenuQuestionId: validWorksheetQuestion.id,
          onToggleMenu: vi.fn(),
          onEdit: vi.fn(),
          onRegenerate,
        }}
      />
    )

    await user.click(screen.getByRole("button", { name: "Regenerate (1 Credit)" }))
    expect(onRegenerate).toHaveBeenCalledWith(validWorksheetQuestion)
  })
})

describe("MathText", () => {
  it("renders plain text and inline math", () => {
    const { container } = render(<MathText>Find $x^2$ value</MathText>)
    expect(container).toHaveTextContent("Find x^2 value")
    expect(screen.getByTestId("inline-math")).toHaveTextContent("x^2")
  })

  it("renders block math", () => {
    render(<MathText>{"$$a+b$$"}</MathText>)
    expect(screen.getByTestId("block-math")).toHaveTextContent("a+b")
  })
})

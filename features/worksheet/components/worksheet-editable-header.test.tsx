import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DEFAULT_HEADER_FIELDS } from "@/features/worksheet/types/header"

import { WorksheetEditableHeader } from "./worksheet-editable-header"

const baseHeader = {
  title: "Physics: Motion",
  instructions: "5 questions - Find velocity.",
  fields: DEFAULT_HEADER_FIELDS,
}

describe("WorksheetEditableHeader", () => {
  it("does not show settings gear when read-only", () => {
    render(<WorksheetEditableHeader header={baseHeader} viewMode="worksheet" />)

    expect(screen.queryByRole("button", { name: "Header settings" })).not.toBeInTheDocument()
  })

  it("shows settings gear in an editable header", () => {
    render(
      <WorksheetEditableHeader
        header={baseHeader}
        viewMode="worksheet"
        editable
        onHeaderChange={{
          onTitleChange: vi.fn(),
          onInstructionsChange: vi.fn(),
          onFieldsChange: vi.fn(),
        }}
      />
    )

    const gearButton = screen.getByRole("button", { name: "Header settings" })
    expect(gearButton).toBeInTheDocument()
    expect(gearButton.closest(".print\\:hidden")).not.toBeNull()
  })

  it("renders student field rows in worksheet mode when toggles are on", () => {
    render(<WorksheetEditableHeader header={baseHeader} viewMode="worksheet" />)

    expect(screen.getByText("Name:")).toBeInTheDocument()
    expect(screen.getByText("Date:")).toBeInTheDocument()
  })

  it("hides student field rows in answer mode", () => {
    render(<WorksheetEditableHeader header={baseHeader} viewMode="answer" />)

    expect(screen.queryByText("Name:")).not.toBeInTheDocument()
    expect(screen.queryByText("Date:")).not.toBeInTheDocument()
  })

  it("calls onFieldsChange when a toggle is changed", async () => {
    const user = userEvent.setup()
    const onFieldsChange = vi.fn()

    render(
      <WorksheetEditableHeader
        header={baseHeader}
        viewMode="worksheet"
        editable
        onHeaderChange={{
          onTitleChange: vi.fn(),
          onInstructionsChange: vi.fn(),
          onFieldsChange,
        }}
      />
    )

    await user.click(screen.getByRole("button", { name: "Header settings" }))
    await user.click(screen.getByRole("switch", { name: /showClassSection/i }))

    expect(onFieldsChange).toHaveBeenCalledWith({
      ...DEFAULT_HEADER_FIELDS,
      showClassSection: true,
    })
  })

  it("calls onTitleChange when the title is edited", async () => {
    const user = userEvent.setup()
    const onTitleChange = vi.fn()

    render(
      <WorksheetEditableHeader
        header={baseHeader}
        viewMode="worksheet"
        editable
        onHeaderChange={{
          onTitleChange,
          onInstructionsChange: vi.fn(),
          onFieldsChange: vi.fn(),
        }}
      />
    )

    await user.click(screen.getByRole("button", { name: "Edit worksheet title" }))
    const input = screen.getByRole("textbox", { name: "Edit worksheet title" })
    await user.clear(input)
    await user.type(input, "Quiz 1")
    await user.tab()

    expect(onTitleChange).toHaveBeenCalledWith("Quiz 1")
  })
})

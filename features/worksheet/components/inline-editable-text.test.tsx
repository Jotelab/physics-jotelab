import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { InlineEditableText } from "./inline-editable-text"

describe("InlineEditableText", () => {
  it("renders static text when not editable", () => {
    render(
      <InlineEditableText
        value="Physics: Motion"
        editable={false}
        ariaLabel="Edit title"
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText("Physics: Motion")).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("commits trimmed value on blur", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <InlineEditableText
        value="Physics: Motion"
        editable
        ariaLabel="Edit title"
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Edit title" }))
    const input = screen.getByRole("textbox", { name: "Edit title" })
    await user.clear(input)
    await user.type(input, "  Custom Title  ")
    await user.tab()

    expect(onChange).toHaveBeenCalledWith("Custom Title")
  })

  it("commits on Enter for single-line input", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <InlineEditableText
        value="Physics: Motion"
        editable
        ariaLabel="Edit title"
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Edit title" }))
    const input = screen.getByRole("textbox", { name: "Edit title" })
    await user.clear(input)
    await user.type(input, "Quiz 1{Enter}")

    expect(onChange).toHaveBeenCalledWith("Quiz 1")
  })

  it("reverts on Escape without calling onChange", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <InlineEditableText
        value="Physics: Motion"
        editable
        ariaLabel="Edit title"
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Edit title" }))
    const input = screen.getByRole("textbox", { name: "Edit title" })
    await user.clear(input)
    await user.type(input, "Draft")
    await user.keyboard("{Escape}")

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Edit title" })).toHaveTextContent("Physics: Motion")
  })

  it("reverts empty blur to the original value", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <InlineEditableText
        value="Physics: Motion"
        editable
        ariaLabel="Edit title"
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Edit title" }))
    const input = screen.getByRole("textbox", { name: "Edit title" })
    await user.clear(input)
    await user.tab()

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Edit title" })).toHaveTextContent("Physics: Motion")
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"

import { measureMmToPx } from "@/features/worksheet/measure-mm"

describe("measureMmToPx", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("returns height from getBoundingClientRect", () => {
    const originalCreateElement = document.createElement.bind(document)
    const probe = document.createElement("div")

    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "div") {
        return probe
      }
      return originalCreateElement(tagName)
    })
    vi.spyOn(probe, "getBoundingClientRect").mockReturnValue({
      height: 265.5,
      width: 0,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      toJSON: () => ({}),
    })

    expect(measureMmToPx(265)).toBe(265.5)
    expect(probe.style.height).toBe("265mm")
  })
})

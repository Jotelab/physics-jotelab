import { describe, expect, it } from "vitest"

import { mapGivenRowsToVariables, mapTargetRowsToVariables } from "./map-variable-rows"

describe("mapGivenRowsToVariables", () => {
  it("parses numeric values and omits empty units", () => {
    const result = mapGivenRowsToVariables([
      {
        id: "1",
        symbol: "t",
        label: "time",
        unit: "s",
        value: "5",
      },
      {
        id: "2",
        symbol: "m",
        label: "mass",
        unit: "",
        value: "2.5",
      },
      {
        id: "3",
        symbol: "a",
        label: "acceleration",
        unit: "m/s²",
        value: "",
      },
    ])

    expect(result[0]?.value).toBe(5)
    expect(result[0]?.unit).toBe("s")
    expect(result[1]?.value).toBe(2.5)
    expect(result[1]?.unit).toBeUndefined()
    expect(result[2]).toEqual({
      symbol: "a",
      label: "acceleration",
      unit: "m/s²",
    })
  })
})

describe("mapTargetRowsToVariables", () => {
  it("maps target rows without value field", () => {
    const result = mapTargetRowsToVariables([
      {
        id: "1",
        symbol: "v",
        label: "velocity",
        unit: "m/s",
        value: "",
      },
    ])

    expect(result).toEqual([{ symbol: "v", label: "velocity", unit: "m/s" }])
  })
})

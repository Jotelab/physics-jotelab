import { describe, expect, it } from "vitest"

import { validWorksheetQuestion } from "@/tests/fixtures/worksheet-question"

import { getFirstUnfilledOrder, getUnfilledOrders } from "./get-unfilled-orders"

describe("getUnfilledOrders", () => {
  it("returns every order up to toOrder when there are no questions", () => {
    expect(getUnfilledOrders([], 3)).toEqual([1, 2, 3])
  })

  it("returns only missing orders when there are gaps", () => {
    const questions = [
      { ...validWorksheetQuestion, order: 1 },
      { ...validWorksheetQuestion, id: "b2b2c3d4-e5f6-4789-a012-3456789abcdf", order: 2 },
      { ...validWorksheetQuestion, id: "c3c3c3d4-e5f6-4789-a012-3456789abdee", order: 4 },
    ]

    expect(getUnfilledOrders(questions, 5)).toEqual([3, 5])
  })

  it("returns an empty list when toOrder is below 1", () => {
    expect(getUnfilledOrders([], 0)).toEqual([])
  })
})

describe("getFirstUnfilledOrder", () => {
  it("returns the lowest missing order", () => {
    const questions = [{ ...validWorksheetQuestion, order: 2 }]

    expect(getFirstUnfilledOrder(questions, 4)).toBe(1)
  })

  it("returns null when every order is filled", () => {
    const questions = [
      { ...validWorksheetQuestion, order: 1 },
      { ...validWorksheetQuestion, id: "b2b2c3d4-e5f6-4789-a012-3456789abcdf", order: 2 },
    ]

    expect(getFirstUnfilledOrder(questions, 2)).toBeNull()
  })
})

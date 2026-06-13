import { beforeEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_HEADER_FIELDS } from "@/features/worksheet/types/header"

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    rpc: mockRpc,
  })),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { failure } from "@/features/generate/errors"
import { updateWorksheetHeaderAction } from "./update-worksheet-header"
import { revalidatePath } from "next/cache"

const worksheetId = "a1b2c3d4-e5f6-4789-a012-3456789abcde"

const generationSettings = {
  lesson: "Motion",
  scenario: "Find velocity.",
  header: {
    title: "Custom Title",
    fields: DEFAULT_HEADER_FIELDS,
  },
}

describe("updateWorksheetHeaderAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
  })

  it("rejects invalid input", async () => {
    const result = await updateWorksheetHeaderAction({
      worksheetId: "not-a-uuid",
      header: { fields: DEFAULT_HEADER_FIELDS },
      resolvedTitle: "Title",
    })

    expect(result).toEqual(failure("VALIDATION_FAILED", "Please check the edited question fields."))
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await updateWorksheetHeaderAction({
      worksheetId,
      header: { fields: DEFAULT_HEADER_FIELDS },
      resolvedTitle: "Custom Title",
    })

    expect(result).toEqual(
      failure("NOT_AUTHENTICATED", "You must be logged in to edit a question.")
    )
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("returns structured RPC failures", async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, code: "WORKSHEET_ACCESS_DENIED" },
      error: null,
    })

    const result = await updateWorksheetHeaderAction({
      worksheetId,
      header: { fields: DEFAULT_HEADER_FIELDS },
      resolvedTitle: "Custom Title",
    })

    expect(result).toEqual(failure("WORKSHEET_ACCESS_DENIED"))
  })

  it("saves header updates and revalidates paths", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        generation_settings: generationSettings,
        title: "Custom Title",
      },
      error: null,
    })

    const result = await updateWorksheetHeaderAction({
      worksheetId,
      header: {
        title: "Custom Title",
        fields: DEFAULT_HEADER_FIELDS,
      },
      resolvedTitle: "Custom Title",
    })

    expect(result).toEqual({
      ok: true,
      data: {
        generationSettings,
        title: "Custom Title",
      },
    })
    expect(mockRpc).toHaveBeenCalledWith("update_worksheet_header", {
      p_worksheet_id: worksheetId,
      p_header: {
        title: "Custom Title",
        fields: DEFAULT_HEADER_FIELDS,
      },
      p_title: "Custom Title",
    })
    expect(revalidatePath).toHaveBeenCalledWith("/generate")
    expect(revalidatePath).toHaveBeenCalledWith("/library")
    expect(revalidatePath).toHaveBeenCalledWith(`/library/${worksheetId}`)
  })

  it("returns save failed when RPC body is malformed", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true },
      error: null,
    })

    const result = await updateWorksheetHeaderAction({
      worksheetId,
      header: { fields: DEFAULT_HEADER_FIELDS },
      resolvedTitle: "Custom Title",
    })

    expect(result).toEqual(failure("SAVE_FAILED", "Could not save the edited question."))
  })
})

"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { ActionResult } from "@/features/generate/result-types"
import { generationSettingsSchema, worksheetHeaderConfigSchema } from "@/features/generate/schemas"
import {
  parseRpcFailure,
  parseRpcSuccessStringField,
  parseStructuredRpcFailure,
} from "@/features/generate/errors"
import { localizedFailure } from "@/lib/i18n/server-errors"
import { createClient } from "@/lib/supabase/server"

const updateWorksheetHeaderInputSchema = z.object({
  worksheetId: z.string().uuid(),
  header: worksheetHeaderConfigSchema,
  resolvedTitle: z.string().trim().min(1).max(120),
})

export async function updateWorksheetHeaderAction(
  input: z.infer<typeof updateWorksheetHeaderInputSchema>
): Promise<ActionResult<{ generationSettings: z.infer<typeof generationSettingsSchema>; title: string }>> {
  const parsed = updateWorksheetHeaderInputSchema.safeParse(input)

  if (!parsed.success) {
    return localizedFailure("VALIDATION_FAILED", "checkEditedQuestion")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return localizedFailure("NOT_AUTHENTICATED", "notAuthenticatedEdit")
  }

  const { data, error } = await supabase.rpc("update_worksheet_header", {
    p_worksheet_id: parsed.data.worksheetId,
    p_header: parsed.data.header,
    p_title: parsed.data.resolvedTitle,
  })

  const structuredFailure = parseStructuredRpcFailure(
    data,
    "SAVE_FAILED",
    (await localizedFailure("SAVE_FAILED", "couldNotSaveEdit")).message
  )
  if (structuredFailure) {
    return structuredFailure
  }

  const generationSettings = parseRpcSuccessGenerationSettings(data)
  const title = parseRpcSuccessStringField(data, "title")

  if (!generationSettings || !title) {
    return parseRpcFailure(
      error,
      "SAVE_FAILED",
      (await localizedFailure("SAVE_FAILED", "couldNotSaveEdit")).message
    )
  }

  revalidatePath("/generate")
  revalidatePath("/library")
  revalidatePath(`/library/${parsed.data.worksheetId}`)

  return {
    ok: true,
    data: {
      generationSettings,
      title,
    },
  }
}

function parseRpcSuccessGenerationSettings(data: unknown) {
  if (typeof data !== "object" || data === null || !("success" in data) || data.success !== true) {
    return null
  }

  const parsed = generationSettingsSchema.safeParse(
    (data as Record<string, unknown>).generation_settings
  )

  return parsed.success ? parsed.data : null
}

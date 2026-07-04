import type { SupabaseClient } from "@supabase/supabase-js"

import type { Subject } from "../types"

export type OwnedWorksheetRow = {
  id: string
  user_id: string
  subject: Subject
  question_count: number
  generation_settings: unknown
}

/**
 * Load a worksheet by id and confirm it belongs to `profileId`.
 *
 * Returns `null` when the row is missing, the query errors, or the worksheet is
 * owned by another profile. This is the single ownership-load used by both the
 * generate core and the variant core (the variant path simply ignores
 * `subject`).
 */
export async function loadOwnedWorksheet(
  supabase: SupabaseClient,
  worksheetId: string,
  profileId: string
): Promise<OwnedWorksheetRow | null> {
  const { data: worksheet, error } = await supabase
    .from("worksheets")
    .select("id, user_id, subject, question_count, generation_settings")
    .eq("id", worksheetId)
    .single<OwnedWorksheetRow>()

  if (error || !worksheet || worksheet.user_id !== profileId) {
    return null
  }

  return worksheet
}

import { z } from "zod"

import {
  MAX_HEADER_INSTRUCTIONS_LEN,
  MAX_HEADER_TITLE_LEN,
} from "@/features/generate/limits"
import {
  worksheetHeaderConfigSchema,
  worksheetHeaderFieldTogglesSchema,
} from "@/features/generate/schemas"

export type WorksheetHeaderFieldToggles = z.infer<typeof worksheetHeaderFieldTogglesSchema>

export type WorksheetHeaderConfig = z.infer<typeof worksheetHeaderConfigSchema>

export type ResolvedWorksheetHeader = {
  title: string
  instructions: string
  fields: WorksheetHeaderFieldToggles
}

export const DEFAULT_HEADER_FIELDS: WorksheetHeaderFieldToggles = {
  showStudentName: true,
  showDate: true,
  showClassSection: false,
  showScoreBox: false,
}

export function mergeHeaderFields(
  fields: Partial<WorksheetHeaderFieldToggles> | null | undefined
): WorksheetHeaderFieldToggles {
  return {
    ...DEFAULT_HEADER_FIELDS,
    ...fields,
  }
}

export function resolveHeaderConfig(
  saved: WorksheetHeaderConfig | null | undefined,
  defaults: { title: string; instructions: string }
): ResolvedWorksheetHeader {
  return {
    title: saved?.title?.trim() ? saved.title.trim() : defaults.title,
    instructions: saved?.instructions?.trim()
      ? saved.instructions.trim()
      : defaults.instructions,
    fields: mergeHeaderFields(saved?.fields),
  }
}

export function toPersistedHeaderConfig(
  config: WorksheetHeaderConfig,
  defaults: { title: string; instructions: string }
): WorksheetHeaderConfig {
  const title = config.title?.trim()
  const instructions = config.instructions?.trim()
  const fields = mergeHeaderFields(config.fields)

  return {
    ...(title && title !== defaults.title ? { title } : {}),
    ...(instructions && instructions !== defaults.instructions ? { instructions } : {}),
    fields,
  }
}

export { MAX_HEADER_INSTRUCTIONS_LEN, MAX_HEADER_TITLE_LEN }

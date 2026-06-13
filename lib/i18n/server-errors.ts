import { getTranslations } from "next-intl/server"

import { failure, type AppFailure, type GenerationErrorCode } from "@/features/generate/errors"
import { translateErrorCode } from "@/lib/i18n/error-messages"

export async function localizedFailure(
  code: GenerationErrorCode,
  messageKey?: string
): Promise<AppFailure> {
  const t = await getTranslations("errors")
  const message = messageKey ? t(messageKey) : translateErrorCode(t, code)

  return failure(code, message)
}

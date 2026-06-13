import type { GenerationErrorCode } from "@/features/generate/errors"

type ErrorTranslator = (key: string) => string

export function translateErrorCode(t: ErrorTranslator, code: GenerationErrorCode) {
  return t(code)
}

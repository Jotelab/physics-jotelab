import type { GenerationErrorCode } from "@/features/generate/errors"
import { isRetryableCode } from "@/features/generate/errors"

export function shouldRetryGeneration(code: GenerationErrorCode | undefined) {
  if (!code) {
    return true
  }

  return isRetryableCode(code)
}

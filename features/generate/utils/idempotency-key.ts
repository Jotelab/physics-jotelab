export function buildGenerateIdempotencyKey(worksheetId: string, order: number): string {
  return `gen:${worksheetId}:${order}`
}

export function buildRegenerateIdempotencyKey(
  worksheetId: string,
  questionId: string,
  attemptId: string
): string {
  return `regen:${worksheetId}:${questionId}:${attemptId}`
}

export function buildVariantRollIdempotencyKey(
  worksheetId: string,
  label: string,
  order: number
): string {
  return `variant:${worksheetId}:${label}:${order}`
}

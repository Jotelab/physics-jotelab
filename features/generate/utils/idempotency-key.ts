export function buildGenerateIdempotencyKey(worksheetId: string, order: number): string {
  return `gen:${worksheetId}:${order}`
}

export function buildRegenerateIdempotencyKey(worksheetId: string, questionId: string): string {
  return `regen:${worksheetId}:${questionId}`
}

export function buildVariantRollIdempotencyKey(
  worksheetId: string,
  label: string,
  order: number
): string {
  return `variant:${worksheetId}:${label}:${order}`
}

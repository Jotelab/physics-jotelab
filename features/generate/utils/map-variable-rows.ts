import type { VariableRow } from "@/features/generate/data/generation-presets"
import type { GivenVariable, TargetVariable } from "@/features/generate/types"

function parseVariableValue(raw: string): string | number {
  const trimmed = raw.trim()
  if (!trimmed) {
    return ""
  }

  const asNumber = Number(trimmed)
  if (Number.isFinite(asNumber)) {
    return asNumber
  }

  return trimmed
}

export function mapGivenRowsToVariables(rows: VariableRow[]): GivenVariable[] {
  return rows.map((row) => {
    const variable: GivenVariable = {
      symbol: row.symbol,
      label: row.label,
      value: parseVariableValue(row.value),
    }

    if (row.unit.trim()) {
      variable.unit = row.unit.trim()
    }

    return variable
  })
}

export function mapTargetRowsToVariables(rows: VariableRow[]): TargetVariable[] {
  return rows.map((row) => {
    const variable: TargetVariable = {
      symbol: row.symbol,
      label: row.label,
    }

    if (row.unit.trim()) {
      variable.unit = row.unit.trim()
    }

    return variable
  })
}

import type { VariableRow } from "@/features/generate/data/generation-presets"
import type {
  GivenVariableConstraint,
  TargetVariable,
} from "@/features/generate/types"

function parseVariableValue(raw: string): string | number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) {
    return undefined
  }

  const asNumber = Number(trimmed)
  if (Number.isFinite(asNumber)) {
    return asNumber
  }

  return trimmed
}

export function mapGivenRowsToVariables(rows: VariableRow[]): GivenVariableConstraint[] {
  return rows.map((row) => {
    const value = parseVariableValue(row.value)
    const variable: GivenVariableConstraint = {
      symbol: row.symbol,
      label: row.label,
    }

    if (value !== undefined) variable.value = value

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

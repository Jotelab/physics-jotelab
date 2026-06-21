import type { MathComplexity } from "@/features/generate/types"

function stripTrailingZeros(value: number): number {
  return Number.parseFloat(value.toFixed(10))
}

function formatScientificNotation(value: number): string {
  if (value === 0) {
    return "0"
  }

  const abs = Math.abs(value)
  if (abs >= 1000 || abs < 0.01) {
    let exponent = Math.floor(Math.log10(abs))
    let mantissa = value / 10 ** exponent
    let roundedMantissa = Math.round(mantissa * 10) / 10

    if (Math.abs(roundedMantissa) >= 10) {
      roundedMantissa /= 10
      exponent += 1
    }

    return `${roundedMantissa} × 10^${exponent}`
  }

  if (Number.isInteger(value)) {
    return String(value)
  }

  return String(stripTrailingZeros(Math.round(value * 100) / 100))
}

export function formatNumericValue(value: number, complexity: MathComplexity): number | string {
  if (!Number.isFinite(value)) {
    return value
  }

  switch (complexity) {
    case "integers":
      return Math.round(value)
    case "decimals":
      return stripTrailingZeros(Math.round(value * 100) / 100)
    case "scientific":
      return formatScientificNotation(value)
    default:
      return value
  }
}

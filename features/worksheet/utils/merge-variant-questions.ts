import type {
  VariantLabel,
  WorksheetQuestion,
  WorksheetVariant,
  WorksheetVersionLabel,
} from "@/features/generate/types"

const VARIANT_LABELS: VariantLabel[] = ["B", "C", "D"]

function findVariant(
  variants: WorksheetVariant[],
  label: VariantLabel
): WorksheetVariant | undefined {
  return variants.find((variant) => variant.label === label)
}

export function mergeVariantQuestions(
  masterQuestions: WorksheetQuestion[],
  versionLabel: WorksheetVersionLabel,
  variants: WorksheetVariant[]
): WorksheetQuestion[] {
  if (versionLabel === "A") {
    return masterQuestions
  }

  const variant = findVariant(variants, versionLabel)

  if (!variant) {
    return masterQuestions
  }

  return masterQuestions.map((masterQuestion) => {
    const roll = variant.rolls.find((entry) => entry.order === masterQuestion.order)

    if (!roll) {
      return masterQuestion
    }

    return {
      ...masterQuestion,
      id: `${masterQuestion.id}:${versionLabel}`,
      given_values: roll.given_values,
      solution: roll.solution,
      question_text: roll.question_text ?? masterQuestion.question_text,
      // The roll's numbers came from its own engine payload (or from the LLM,
      // in which case there is none) — never inherit the master's, which
      // describes different numbers. The template diagram stays inherited: it
      // is symbol-only and the roll keeps the master's Given/Find split.
      sympy_data: roll.sympy_data,
    }
  })
}

export function getAvailableVersionLabels(
  savedVariants: WorksheetVariant[],
  ephemeralVariants: WorksheetVariant[]
): WorksheetVersionLabel[] {
  const labels = new Set<WorksheetVersionLabel>(["A"])

  for (const variant of [...savedVariants, ...ephemeralVariants]) {
    labels.add(variant.label)
  }

  return (["A", "B", "C", "D"] as const).filter((label) => labels.has(label))
}

export function allocateVariantLabels(
  additionalCount: number,
  usedLabels: Iterable<VariantLabel> = []
): VariantLabel[] | null {
  const used = new Set(usedLabels)
  const available = VARIANT_LABELS.filter((label) => !used.has(label))

  if (additionalCount < 1 || additionalCount > available.length) {
    return null
  }

  return available.slice(0, additionalCount)
}

export function mergeSavedAndEphemeralVariants(
  savedVariants: WorksheetVariant[],
  ephemeralVariants: WorksheetVariant[]
): WorksheetVariant[] {
  const byLabel = new Map<VariantLabel, WorksheetVariant>()

  for (const variant of savedVariants) {
    byLabel.set(variant.label, variant)
  }

  for (const variant of ephemeralVariants) {
    byLabel.set(variant.label, variant)
  }

  return (["B", "C", "D"] as const)
    .map((label) => byLabel.get(label))
    .filter((variant): variant is WorksheetVariant => Boolean(variant))
}

export function hasUnsavedVariants(
  savedVariants: WorksheetVariant[],
  ephemeralVariants: WorksheetVariant[]
): boolean {
  if (ephemeralVariants.length === 0) {
    return false
  }

  return ephemeralVariants.some((ephemeral) => {
    const saved = savedVariants.find((variant) => variant.label === ephemeral.label)
    if (!saved) {
      return true
    }

    return JSON.stringify(saved.rolls) !== JSON.stringify(ephemeral.rolls)
  })
}

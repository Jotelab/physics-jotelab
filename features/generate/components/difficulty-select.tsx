"use client"

import { useTranslations } from "next-intl"

import { BuilderSelectDropdown } from "@/features/generate/components/builder-dropdown"
import {
  CONCEPTUAL_DIFFICULTY_OPTIONS,
  MATH_COMPLEXITY_OPTIONS,
} from "@/features/generate/constants/difficulty-settings"
import type { ConceptualDifficulty, MathComplexity } from "@/features/generate/types"

interface MathComplexitySelectProps {
  value: MathComplexity
  onChange: (value: MathComplexity) => void
  disabled?: boolean
}

export function MathComplexitySelect({ value, onChange, disabled }: MathComplexitySelectProps) {
  const t = useTranslations("generate")

  return (
    <BuilderSelectDropdown
      label={t("mathComplexity")}
      id="math-complexity-select"
      listId="math-complexity-listbox"
      options={MATH_COMPLEXITY_OPTIONS}
      value={value}
      disabled={disabled}
      placeholder={t("mathComplexity.integers")}
      getKey={(option) => option.value}
      getLabel={(option) => t(option.labelKey)}
      onChange={(option) => onChange(option.value)}
    />
  )
}

interface ConceptualDifficultySelectProps {
  value: ConceptualDifficulty
  onChange: (value: ConceptualDifficulty) => void
  disabled?: boolean
}

export function ConceptualDifficultySelect({
  value,
  onChange,
  disabled,
}: ConceptualDifficultySelectProps) {
  const t = useTranslations("generate")

  return (
    <BuilderSelectDropdown
      label={t("conceptualDifficulty")}
      id="conceptual-difficulty-select"
      listId="conceptual-difficulty-listbox"
      options={CONCEPTUAL_DIFFICULTY_OPTIONS}
      value={value}
      disabled={disabled}
      placeholder={t("conceptualDifficulty.level_1")}
      getKey={(option) => option.value}
      getLabel={(option) => t(option.labelKey)}
      onChange={(option) => onChange(option.value)}
    />
  )
}

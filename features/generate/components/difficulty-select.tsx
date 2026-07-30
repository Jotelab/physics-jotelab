"use client"

import { Star } from "lucide-react"
import { useTranslations } from "next-intl"

import { BuilderSelectDropdown } from "@/features/generate/components/builder-dropdown"
import {
  CONCEPTUAL_DIFFICULTY_OPTIONS,
  MATH_COMPLEXITY_OPTIONS,
} from "@/features/generate/constants/difficulty-settings"
import type { ConceptualDifficulty, MathComplexity } from "@/features/generate/types"
import { cn } from "@/lib/utils"

const MAX_DIFFICULTY_LEVEL = CONCEPTUAL_DIFFICULTY_OPTIONS.length

function difficultyLevel(value: ConceptualDifficulty): number {
  return Number(value.split("_")[1]) || 1
}

/**
 * Star row for the difficulty control. Decorative (the level label carries
 * the accessible text); `animated` pops the filled stars in sequence and is
 * re-triggered by keying the row on the selected level.
 */
function DifficultyStars({ level, animated = false }: { level: number; animated?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: MAX_DIFFICULTY_LEVEL }, (_, index) => {
        const filled = index < level
        return (
          <Star
            key={index}
            className={cn(
              "size-4",
              filled ? "text-[var(--chart-4)]" : "text-muted-foreground/40",
              filled && animated && "animate-star-pop"
            )}
            style={filled && animated ? { animationDelay: `${index * 80}ms` } : undefined}
            fill={filled ? "currentColor" : "none"}
            strokeWidth={filled ? 0 : 2}
          />
        )
      })}
    </span>
  )
}

interface MathComplexitySelectProps {
  value: MathComplexity
  onChange: (value: MathComplexity) => void
  disabled?: boolean
}

export function MathComplexitySelect({ value, onChange, disabled }: MathComplexitySelectProps) {
  const t = useTranslations("generate")

  return (
    <BuilderSelectDropdown
      label={t("mathComplexity.title")}
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
      label={t("conceptualDifficulty.title")}
      id="conceptual-difficulty-select"
      listId="conceptual-difficulty-listbox"
      options={CONCEPTUAL_DIFFICULTY_OPTIONS}
      value={value}
      disabled={disabled}
      placeholder={t("conceptualDifficulty.level_1")}
      getKey={(option) => option.value}
      getLabel={(option) => t(option.labelKey)}
      renderOption={(option) => (
        <span className="flex items-center gap-2">
          <DifficultyStars level={difficultyLevel(option.value)} />
          {t(option.labelKey)}
        </span>
      )}
      renderValue={(option) => (
        <span key={option.value} className="flex items-center gap-2">
          <DifficultyStars level={difficultyLevel(option.value)} animated />
          {t(option.labelKey)}
        </span>
      )}
      onChange={(option) => onChange(option.value)}
    />
  )
}

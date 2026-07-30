"use client"

import { Star } from "lucide-react"
import { useTranslations } from "next-intl"

import { BuilderSelectDropdown } from "@/features/generate/components/builder-dropdown"
import {
  CONCEPTUAL_DIFFICULTY_OPTIONS,
  MATH_COMPLEXITY_OPTIONS,
} from "@/features/generate/constants/difficulty-settings"
import type { ConceptualDifficulty, MathComplexity } from "@/features/generate/types"
import { MAX_GENERATABLE_STARS } from "@/lib/engine/star-plans"
import { formLabelClass } from "@/lib/ui-classes"
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

interface StarDifficultySelectProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

/**
 * The star ladder (lib/engine/star-plans.ts): 1–5★ of *structural* difficulty
 * for engine-backed topics, independent of the numbers knob. Rendered as a
 * tactile star rating; the 5★ tier is visible but locked until worksheets
 * support multi-part chained questions.
 */
export function StarDifficultySelect({ value, onChange, disabled }: StarDifficultySelectProps) {
  const t = useTranslations("generate")
  const levels = [1, 2, 3, 4, 5]

  return (
    <div className="space-y-2">
      <span className={formLabelClass}>{t("starDifficulty.title")}</span>
      <div
        role="radiogroup"
        aria-label={t("starDifficulty.title")}
        className="flex items-center gap-0.5"
      >
        {levels.map((level) => {
          const locked = level > MAX_GENERATABLE_STARS
          const filled = level <= value
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={value === level}
              aria-label={`${level}★ ${t(`starDifficulty.level_${level}_name`)}`}
              disabled={disabled || locked}
              title={
                locked
                  ? t("starDifficulty.fiveStarSoon")
                  : t(`starDifficulty.level_${level}_name`)
              }
              onClick={() => onChange(level)}
              className={cn(
                "rounded-md p-1.5 outline-none transition-transform duration-150 ease-[var(--ease-spring)]",
                "hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
                "focus-visible:ring-3 focus-visible:ring-ring/50",
                locked && "cursor-not-allowed opacity-40 hover:scale-100"
              )}
            >
              <Star
                // Re-keying on the selected value re-triggers the pop cascade.
                key={`${value}-${level}`}
                className={cn(
                  "size-6 lg:size-5",
                  filled ? "animate-star-pop text-[var(--chart-4)]" : "text-muted-foreground/40"
                )}
                style={filled ? { animationDelay: `${(level - 1) * 60}ms` } : undefined}
                fill={filled ? "currentColor" : "none"}
                strokeWidth={filled ? 0 : 2}
              />
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {t(`starDifficulty.level_${value}_name`)}.
        </span>{" "}
        {t(`starDifficulty.level_${value}_blurb`)}
      </p>
    </div>
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

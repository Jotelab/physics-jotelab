"use client"

import { Check } from "lucide-react"
import { useTranslations } from "next-intl"

import { getLessonPresets } from "@/features/generate/data/generation-presets"
import { DEFAULT_SUBJECT } from "@/features/generate/schemas"
import { resolveEngineTopic } from "@/lib/engine/topics"
import { cn } from "@/lib/utils"

interface LessonCardGridProps {
  selectedIds: string[]
  onToggle: (lessonId: string) => void
  disabled?: boolean
}

/**
 * Topic selection as a grid of checkbox cards — name + description per topic,
 * multi-select. Only engine-backed lessons appear as cards (their generation
 * is verified end to end); the free-text combobox below the grid keeps the
 * LLM-only lessons reachable.
 */
export function LessonCardGrid({ selectedIds, onToggle, disabled }: LessonCardGridProps) {
  const t = useTranslations("generate")
  const topics = getLessonPresets().filter(
    (preset) => resolveEngineTopic(preset.id, DEFAULT_SUBJECT) !== null
  )

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{t("topics.title")}</span>
        {selectedIds.length > 1 ? (
          <span className="text-xs text-muted-foreground">
            {t("topics.selectedCount", { count: selectedIds.length })}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{t("topics.hint")}</p>
      <div
        role="group"
        aria-label={t("topics.title")}
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1"
      >
        {topics.map(({ id }) => {
          const selected = selectedIds.includes(id)
          return (
            <button
              key={id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onToggle(id)}
              className={cn(
                "relative rounded-xl border bg-background p-3 pr-11 text-left",
                "transition-all duration-150 ease-[var(--ease-spring)]",
                "hover:border-ring/60 hover:shadow-sm active:scale-[0.98] motion-reduce:active:scale-100",
                "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "disabled:pointer-events-none disabled:opacity-50",
                selected ? "border-primary bg-accent/50 shadow-sm" : "border-border"
              )}
            >
              <span className="font-heading block text-sm font-semibold">
                {t(`presets.lessons.${id}`)}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {t(`presets.lessonDescriptions.${id}`)}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-3 right-3 flex size-5 items-center justify-center rounded-md border transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background"
                )}
              >
                {selected ? <Check className="animate-star-pop size-3.5" strokeWidth={3} /> : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Check, ChevronDown, Layers } from "lucide-react"
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
 * Topic selection as a deck of checkbox cards. Collapsed, the topics sit as a
 * stacked deck (title + selection summary on the front card); hovering fans
 * the deck out as a peek, and any click pins it open. Expanded, the cards
 * deal into a scrollable list — name + description per topic, multi-select.
 *
 * Only engine-backed lessons appear as cards (their generation is verified
 * end to end); the free-text combobox below the deck keeps the LLM-only
 * lessons reachable.
 */
export function LessonCardGrid({ selectedIds, onToggle, disabled }: LessonCardGridProps) {
  const t = useTranslations("generate")
  const [expanded, setExpanded] = useState(false)
  // A hover-opened deck restacks on mouse-out; a click pins it open so an
  // accidental mouse exit never interrupts picking.
  const [pinned, setPinned] = useState(false)

  const topics = getLessonPresets().filter(
    (preset) => resolveEngineTopic(preset.id, DEFAULT_SUBJECT) !== null
  )

  const selectedLabels = selectedIds.map((id) => t(`presets.lessons.${id}`))
  const summary =
    selectedLabels.length === 0
      ? t("topics.deckHint")
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`

  function collapse() {
    setExpanded(false)
    setPinned(false)
  }

  function handleHeaderClick() {
    if (expanded && pinned) {
      collapse()
    } else {
      setExpanded(true)
      setPinned(true)
    }
  }

  return (
    <div
      className="space-y-2"
      onMouseEnter={() => {
        if (!disabled) setExpanded(true)
      }}
      onMouseLeave={() => {
        if (!pinned) setExpanded(false)
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") collapse()
      }}
    >
      <div className={cn("relative", !expanded && "pt-3")}>
        {/* The peeking back cards of the collapsed deck. */}
        {!expanded ? (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-x-3 top-0 h-8 rotate-[1.6deg] rounded-xl border bg-muted/50"
            />
            <span
              aria-hidden="true"
              className="absolute inset-x-1.5 top-1.5 h-8 -rotate-[0.9deg] rounded-xl border bg-background shadow-sm"
            />
          </>
        ) : null}

        <button
          type="button"
          aria-expanded={expanded}
          disabled={disabled}
          onClick={handleHeaderClick}
          onFocus={() => setExpanded(true)}
          className={cn(
            "relative w-full rounded-xl border bg-background text-left",
            "transition-all duration-150 ease-[var(--ease-spring)]",
            "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:opacity-50",
            expanded
              ? "flex items-center justify-between px-3 py-2"
              : "block p-3 shadow-sm hover:shadow-md active:scale-[0.99] motion-reduce:active:scale-100"
          )}
        >
          {expanded ? (
            <>
              <span className="text-sm font-medium">{t("topics.title")}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {selectedIds.length > 0
                  ? t("topics.selectedCount", { count: selectedIds.length })
                  : null}
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 rotate-180 transition-transform duration-150"
                />
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-2">
                <Layers aria-hidden="true" className="size-4 text-primary" />
                <span className="font-heading text-sm font-semibold">
                  {t("topics.title")}
                </span>
                {selectedIds.length > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {t("topics.selectedCount", { count: selectedIds.length })}
                  </span>
                ) : null}
              </span>
              <span className="mt-1 flex items-center justify-between gap-2">
                <span className="block truncate text-xs text-muted-foreground">
                  {summary}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </span>
            </>
          )}
        </button>
      </div>

      {expanded ? (
        <>
          <p className="text-xs text-muted-foreground">{t("topics.hint")}</p>
          <div
            role="group"
            aria-label={t("topics.title")}
            className="grid max-h-80 grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-1"
          >
            {topics.map(({ id }, index) => {
              const selected = selectedIds.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => {
                    setPinned(true)
                    onToggle(id)
                  }}
                  className={cn(
                    "animate-card-deal relative rounded-xl border bg-background p-3 pr-11 text-left",
                    "transition-all duration-150 ease-[var(--ease-spring)]",
                    "hover:border-ring/60 hover:shadow-sm active:scale-[0.98] motion-reduce:active:scale-100",
                    "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    "disabled:pointer-events-none disabled:opacity-50",
                    selected ? "border-primary bg-accent/50 shadow-sm" : "border-border"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
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
                    {selected ? (
                      <Check className="animate-star-pop size-3.5" strokeWidth={3} />
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}

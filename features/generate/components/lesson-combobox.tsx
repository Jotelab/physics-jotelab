"use client"

import { useState } from "react"
import { ChevronsUpDown } from "lucide-react"
import { useTranslations } from "next-intl"

import { Input } from "@/components/ui/input"
import {
  BuilderDropdownList,
  BuilderFieldShell,
  builderTriggerClass,
  useBuilderDropdown,
} from "@/features/generate/components/builder-dropdown"
import {
  getLessonLabel,
  getLessonPresets,
  resolveLessonKey,
  type LessonPresetId,
} from "@/features/generate/data/generation-presets"
import { DEFAULT_SUBJECT } from "@/features/generate/schemas"
import { resolveEngineTopic } from "@/lib/engine/topics"

interface LessonComboboxProps {
  value: string
  onChange: (value: string) => void
  /** Fired when the user picks a catalog suggestion (not on free-text typing). */
  onSuggestionSelect?: (value: string) => void
  disabled?: boolean
}

export function LessonCombobox({
  value,
  onChange,
  onSuggestionSelect,
  disabled,
}: LessonComboboxProps) {
  const t = useTranslations("generate")
  const { open, setOpen, containerRef } = useBuilderDropdown()
  const resolved = resolveLessonKey(value)
  const displayValue =
    resolved.isPreset && resolved.lessonId
      ? t(`presets.lessons.${resolved.lessonId}`)
      : value
  const [inputValue, setInputValue] = useState(displayValue)
  const [prevValue, setPrevValue] = useState(value)

  if (value !== prevValue) {
    setPrevValue(value)
    setInputValue(displayValue)
  } else if (resolved.isPreset && inputValue !== displayValue) {
    setInputValue(displayValue)
  }

  // Suggest only lessons with real engine-backed content; the catalog's
  // LLM-only lessons stay reachable as free text until their engines land.
  const presets = getLessonPresets().filter(
    (preset) => resolveEngineTopic(preset.id, DEFAULT_SUBJECT) !== null
  )
  const isShowingCatalogSelection =
    resolved.isPreset && resolved.lessonId && inputValue === displayValue
  const query = isShowingCatalogSelection ? "" : inputValue.trim().toLowerCase()
  const filtered = query
    ? presets.filter((preset) => {
        const translated = t(`presets.lessons.${preset.id}`).toLowerCase()
        const english = getLessonLabel(preset.id).toLowerCase()
        return translated.includes(query) || english.includes(query)
      })
    : presets

  function handleInputChange(text: string) {
    setInputValue(text)
    onChange(text)
    setOpen(true)
  }

  function handleSelect(lessonId: LessonPresetId) {
    const label = t(`presets.lessons.${lessonId}`)
    setInputValue(label)
    onChange(lessonId)
    onSuggestionSelect?.(lessonId)
    setOpen(false)
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") setOpen(false)
    if (event.key === "ArrowDown" && filtered.length > 0) setOpen(true)
  }

  return (
    <BuilderFieldShell label={t("lesson")}>
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Input
            id="lesson-combobox"
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls="lesson-listbox"
            aria-label={t("lesson")}
            value={inputValue}
            disabled={disabled}
            placeholder={t("lessonPlaceholder")}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className={builderTriggerClass}
          />
          <button
            type="button"
            aria-label={t("toggleLessonSuggestions")}
            tabIndex={-1}
            disabled={disabled}
            onClick={() => setOpen((prev) => !prev)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground disabled:cursor-not-allowed lg:w-auto lg:px-2"
          >
            <ChevronsUpDown className="size-5 lg:size-4" />
          </button>
        </div>

        {open && filtered.length > 0 ? (
          <BuilderDropdownList
            listId="lesson-listbox"
            ariaLabel={t("lessonSuggestions")}
            options={filtered}
            selectedKey={resolved.lessonId ?? value}
            getKey={(preset) => preset.id}
            getLabel={(preset) => t(`presets.lessons.${preset.id}`)}
            onSelect={(preset) => handleSelect(preset.id)}
          />
        ) : null}
      </div>
    </BuilderFieldShell>
  )
}

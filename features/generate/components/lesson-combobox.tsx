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
import { LESSON_SUGGESTIONS } from "@/features/generate/data/generation-presets"

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
  const [inputValue, setInputValue] = useState(value)
  const [prevValue, setPrevValue] = useState(value)

  if (value !== prevValue) {
    setPrevValue(value)
    setInputValue(value)
  }

  const filtered = inputValue.trim()
    ? LESSON_SUGGESTIONS.filter((s) => s.toLowerCase().includes(inputValue.toLowerCase()))
    : LESSON_SUGGESTIONS

  function handleInputChange(text: string) {
    setInputValue(text)
    onChange(text)
    setOpen(true)
  }

  function handleSelect(lesson: string) {
    setInputValue(lesson)
    onChange(lesson)
    onSuggestionSelect?.(lesson)
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
            selectedKey={value}
            getKey={(lesson) => lesson}
            getLabel={(lesson) => lesson}
            onSelect={handleSelect}
          />
        ) : null}
      </div>
    </BuilderFieldShell>
  )
}

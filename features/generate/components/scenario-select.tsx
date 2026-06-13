"use client"

import { useTranslations } from "next-intl"

import { getScenariosForLesson, type ScenarioPreset } from "@/features/generate/data/generation-presets"
import { BuilderSelectDropdown } from "@/features/generate/components/builder-dropdown"
import type { Subject } from "@/features/generate/types"

interface ScenarioSelectProps {
  subject: Subject | ""
  lesson: string
  value: string
  onChange: (scenarioId: string, description: string) => void
  disabled?: boolean
}

export function ScenarioSelect({
  subject,
  lesson,
  value,
  onChange,
  disabled,
}: ScenarioSelectProps) {
  const t = useTranslations("generate")
  const trimmedLesson = lesson.trim()
  const canSelect = Boolean(subject && trimmedLesson)

  const { scenarios, isFallback } =
    subject && trimmedLesson
      ? getScenariosForLesson(subject, trimmedLesson)
      : { scenarios: [], isFallback: false }

  const isDisabled = !canSelect || disabled

  const placeholder = canSelect
    ? t("chooseScenario")
    : trimmedLesson
      ? t("chooseSubjectFirstScenario")
      : t("enterLessonFirst")

  const hint =
    isFallback && canSelect ? (
      <p className="text-xs text-muted-foreground">{t("generalScenariosHint")}</p>
    ) : null

  return (
    <BuilderSelectDropdown<ScenarioPreset>
      label={t("scenario")}
      id="scenario-select"
      listId="scenario-listbox"
      options={scenarios}
      value={value}
      disabled={isDisabled}
      placeholder={placeholder}
      hint={hint}
      getKey={(preset) => preset.id}
      getLabel={(preset) => preset.label}
      onChange={(preset) => onChange(preset.id, preset.description)}
    />
  )
}

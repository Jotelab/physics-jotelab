"use client"

import { useTranslations } from "next-intl"

import {
  getScenarioDescription,
  getScenariosForLesson,
  type ScenarioPreset,
} from "@/features/generate/data/generation-presets"
import { BuilderSelectDropdown } from "@/features/generate/components/builder-dropdown"

interface ScenarioSelectProps {
  lesson: string
  value: string
  onChange: (scenarioId: string, description: string) => void
  disabled?: boolean
}

export function ScenarioSelect({
  lesson,
  value,
  onChange,
  disabled,
}: ScenarioSelectProps) {
  const t = useTranslations("generate")
  const trimmedLesson = lesson.trim()
  const canSelect = Boolean(trimmedLesson)

  const { scenarios, isFallback } = trimmedLesson
    ? getScenariosForLesson(trimmedLesson)
    : { scenarios: [], isFallback: false }

  const isDisabled = !canSelect || disabled

  const placeholder = canSelect ? t("chooseScenario") : t("enterLessonFirst")

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
      getLabel={(preset) =>
        t(`presets.scenarios.${preset.lessonId}.${preset.index}.label`)
      }
      onChange={(preset) =>
        onChange(preset.id, getScenarioDescription(lesson, preset.id))
      }
    />
  )
}

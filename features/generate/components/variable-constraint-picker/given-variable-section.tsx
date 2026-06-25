"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { VariableChip } from "@/features/generate/components/variable-constraint-picker/variable-chip"
import {
  getCompatibleGivenIds,
  getIncompatibleGivenIds,
} from "@/features/generate/data/variable-compatibility"
import {
  getVariablesForLesson,
  type VariablePreset,
} from "@/features/generate/data/generation-presets"
import { formLabelClass } from "@/lib/ui-classes"

function variableHint(
  preset: VariablePreset,
  label: string,
  t: ReturnType<typeof useTranslations<"generate">>
): string {
  const parts = [label]
  if (preset.defaultValue != null) {
    parts.push(
      t("defaultValue", {
        value: preset.defaultValue,
        unit: preset.unit ? ` ${preset.unit}` : "",
      })
    )
  } else if (preset.unit) {
    parts.push(t("unitOnly", { unit: preset.unit }))
  }
  return parts.join(" · ")
}

interface GivenVariableSectionProps {
  lesson: string
  findVariableIds: string[]
  targetRandomize: boolean
  givenVariableIds: string[]
  onGivenChange: (ids: string[]) => void
  disabled?: boolean
}

export function GivenVariableSection({
  lesson,
  findVariableIds,
  targetRandomize,
  givenVariableIds,
  onGivenChange,
  disabled,
}: GivenVariableSectionProps) {
  const t = useTranslations("generate")
  const [showAll, setShowAll] = useState(false)
  const controlsDisabled = Boolean(disabled)
  const presets = getVariablesForLesson(lesson)
  const compatibleIds = new Set(
    getCompatibleGivenIds(lesson, findVariableIds, targetRandomize)
  )
  const incompatibleIds = new Set(
    getIncompatibleGivenIds(lesson, findVariableIds, targetRandomize)
  )
  const findSet = new Set(findVariableIds)

  const visiblePresets = presets.filter((preset) => {
    if (findSet.has(preset.id)) return false
    if (compatibleIds.has(preset.id)) return true
    return showAll && incompatibleIds.has(preset.id)
  })

  function handleGivenToggle(id: string, checked: boolean) {
    if (checked) {
      onGivenChange([...givenVariableIds.filter((item) => item !== id), id])
    } else {
      onGivenChange(givenVariableIds.filter((item) => item !== id))
    }
  }

  const hasExtra = incompatibleIds.size > 0

  return (
    <fieldset className="space-y-3" disabled={controlsDisabled}>
      <div className="space-y-1">
        <legend className={formLabelClass}>{t("givenSectionTitle")}</legend>
        <p className="text-xs text-muted-foreground">{t("givenSectionHint")}</p>
      </div>

      {visiblePresets.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("noCompatibleGivens")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-3 lg:gap-0.5 xl:grid-cols-4">
          {visiblePresets.map((preset) => {
            const label = t(`presets.variables.${preset.id}`)
            const isCompatible = compatibleIds.has(preset.id)
            const findSymbols = findVariableIds
              .map((id) => presets.find((item) => item.id === id)?.symbol)
              .filter((symbol): symbol is string => Boolean(symbol))
              .join(", ")

            return (
              <VariableChip
                key={preset.id}
                preset={preset}
                inputId={`given-${preset.id}`}
                inputType="checkbox"
                checked={givenVariableIds.includes(preset.id)}
                disabled={controlsDisabled || !isCompatible}
                hint={
                  isCompatible
                    ? variableHint(preset, label, t)
                    : t("givenNotTypicalForFind", { symbols: findSymbols })
                }
                onToggle={(checked) => handleGivenToggle(preset.id, checked)}
              />
            )
          })}
        </div>
      )}

      {hasExtra ? (
        <button
          type="button"
          className="text-xs text-primary underline-offset-4 hover:underline"
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? t("hideExtraGivens") : t("showAllGivens")}
        </button>
      ) : null}
    </fieldset>
  )
}

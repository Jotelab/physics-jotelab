"use client"

import { useTranslations } from "next-intl"

import { VariableChip } from "@/features/generate/components/variable-constraint-picker/variable-chip"
import { getFindPool } from "@/features/generate/data/variable-compatibility"
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

function formatSymbolChain(symbols: string[]): string {
  return symbols.join(" → ")
}

interface FindVariableSectionProps {
  lesson: string
  findVariableIds: string[]
  targetRandomize: boolean
  onFindChange: (ids: string[]) => void
  onTargetRandomizeChange: (enabled: boolean) => void
  disabled?: boolean
}

export function FindVariableSection({
  lesson,
  findVariableIds,
  targetRandomize,
  onFindChange,
  onTargetRandomizeChange,
  disabled,
}: FindVariableSectionProps) {
  const t = useTranslations("generate")
  const presets = getVariablesForLesson(lesson)
  const controlsDisabled = Boolean(disabled)
  const pool = getFindPool(lesson, findVariableIds, targetRandomize)
  const poolSymbols = pool
    .map((id) => presets.find((preset) => preset.id === id)?.symbol)
    .filter((symbol): symbol is string => Boolean(symbol))

  function handleFindToggle(id: string, checked: boolean) {
    if (checked) {
      onFindChange([...findVariableIds.filter((item) => item !== id), id])
    } else {
      onFindChange(findVariableIds.filter((item) => item !== id))
    }
  }

  const summary =
    poolSymbols.length > 0
      ? targetRandomize
        ? t("targetRandomSummary", { symbols: poolSymbols.join(", ") })
        : t("targetRotateSummary", { symbols: formatSymbolChain(poolSymbols) })
      : null

  return (
    <fieldset className="space-y-3" disabled={controlsDisabled}>
      <div className="space-y-1">
        <legend className={formLabelClass}>{t("findSectionTitle")}</legend>
        <p className="text-xs text-muted-foreground">{t("findSectionHint")}</p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-3 lg:gap-0.5 xl:grid-cols-4">
        {presets.map((preset) => {
          const label = t(`presets.variables.${preset.id}`)
          return (
            <VariableChip
              key={preset.id}
              preset={preset}
              inputId={`find-${preset.id}`}
              inputType="checkbox"
              checked={findVariableIds.includes(preset.id)}
              disabled={controlsDisabled}
              hint={variableHint(preset, label, t)}
              onToggle={(checked) => handleFindToggle(preset.id, checked)}
            />
          )
        })}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={targetRandomize}
          disabled={controlsDisabled}
          onChange={(event) => onTargetRandomizeChange(event.target.checked)}
          className="size-4"
        />
        <span>{t("targetRandomize")}</span>
      </label>

      {summary ? <p className="text-xs text-muted-foreground">{summary}</p> : null}
    </fieldset>
  )
}

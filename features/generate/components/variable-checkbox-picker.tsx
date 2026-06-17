"use client"

import { useTranslations } from "next-intl"

import {
  getVariablesForLesson,
  type VariablePreset,
} from "@/features/generate/data/generation-presets"
import { formLabelClass } from "@/lib/ui-classes"
import { cn } from "@/lib/utils"

interface VariableCheckboxPickerProps {
  lesson: string
  givenVariableIds: string[]
  targetVariableId: string
  onGivenChange: (ids: string[]) => void
  onTargetChange: (id: string) => void
  disabled?: boolean
}

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

const symbolClass =
  "font-mono text-lg leading-none tracking-tight lg:text-base"

function VariableChip({
  preset,
  inputId,
  inputType,
  name,
  checked,
  disabled,
  onToggle,
  hint,
}: {
  preset: VariablePreset
  inputId: string
  inputType: "checkbox" | "radio"
  name?: string
  checked: boolean
  disabled: boolean
  onToggle: (checked: boolean) => void
  hint: string
}) {
  return (
    <label
      htmlFor={inputId}
      title={hint}
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-muted/60 lg:min-h-9 lg:gap-2 lg:rounded-lg lg:px-2.5 lg:py-1.5",
        checked && "bg-muted/80 ring-1 ring-primary/30"
      )}
    >
      <input
        id={inputId}
        type={inputType}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="size-5 shrink-0 lg:size-4"
      />
      <span className={symbolClass}>{preset.symbol}</span>
    </label>
  )
}

export function VariableCheckboxPicker({
  lesson,
  givenVariableIds,
  targetVariableId,
  onGivenChange,
  onTargetChange,
  disabled,
}: VariableCheckboxPickerProps) {
  const t = useTranslations("generate")
  const presets = getVariablesForLesson(lesson)
  const controlsDisabled = Boolean(disabled)
  const hasLesson = Boolean(lesson.trim())

  function handleGivenToggle(id: string, checked: boolean) {
    if (checked) {
      onGivenChange([...givenVariableIds.filter((x) => x !== id), id])
      if (targetVariableId === id) onTargetChange("")
    } else {
      onGivenChange(givenVariableIds.filter((x) => x !== id))
    }
  }

  function handleTargetToggle(id: string, checked: boolean) {
    if (checked) {
      onTargetChange(id)
      onGivenChange(givenVariableIds.filter((x) => x !== id))
    } else if (targetVariableId === id) {
      onTargetChange("")
    }
  }

  if (!hasLesson) {
    return (
      <p className="text-xs text-muted-foreground">{t("selectLessonForVariables")}</p>
    )
  }

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2" disabled={controlsDisabled}>
        <legend className={formLabelClass}>{t("given")}</legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-3 lg:gap-0.5 xl:grid-cols-4">
          {presets.map((preset) => {
            const label = t(`presets.variables.${preset.id}`)
            return (
              <VariableChip
                key={preset.id}
                preset={preset}
                inputId={`given-${preset.id}`}
                inputType="checkbox"
                checked={givenVariableIds.includes(preset.id)}
                disabled={controlsDisabled}
                hint={variableHint(preset, label, t)}
                onToggle={(checked) => handleGivenToggle(preset.id, checked)}
              />
            )
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2" disabled={controlsDisabled}>
        <legend className={formLabelClass}>{t("find")}</legend>
        <div
          className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-3 lg:gap-0.5 xl:grid-cols-4"
          role="radiogroup"
          aria-label={t("targetVariable")}
        >
          {presets.map((preset) => {
            const label = t(`presets.variables.${preset.id}`)
            return (
              <VariableChip
                key={preset.id}
                preset={preset}
                inputId={`target-${preset.id}`}
                inputType="radio"
                name="target-variable"
                checked={targetVariableId === preset.id}
                disabled={controlsDisabled}
                hint={variableHint(preset, label, t)}
                onToggle={(checked) => handleTargetToggle(preset.id, checked)}
              />
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}

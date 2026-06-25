"use client"

import { cn } from "@/lib/utils"

import type { VariablePreset } from "@/features/generate/data/generation-presets"

const symbolClass =
  "font-mono text-lg leading-none tracking-tight lg:text-base"

export function VariableChip({
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
        checked && "bg-muted/80 ring-1 ring-primary/30",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
      )}
    >
      <input
        id={inputId}
        type={inputType}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onToggle(event.target.checked)}
        className="size-5 shrink-0 lg:size-4"
      />
      <span className={symbolClass}>{preset.symbol}</span>
    </label>
  )
}

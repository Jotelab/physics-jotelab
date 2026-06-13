"use client"

import { cn } from "@/lib/utils"

export type SegmentedControlOption<T extends string> = {
  value: T
  label: string
  id?: string
}

type SegmentedControlProps<T extends string> = {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedControlOption<T>[]
  className?: string
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-1 rounded-xl border bg-muted p-2 lg:gap-0 lg:rounded-md lg:p-1",
        className
      )}
      role="group"
    >
      {options.map((option) => {
        const isActive = value === option.value

        return (
          <button
            key={option.value}
            type="button"
            id={option.id}
            aria-pressed={isActive}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "min-h-14 rounded-lg px-5 text-lg font-medium transition-colors lg:min-h-0 lg:h-8 lg:rounded-md lg:px-3 lg:text-sm",
              isActive ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

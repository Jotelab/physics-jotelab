"use client"

import type { ComponentType } from "react"
import { useTranslations } from "next-intl"

import { formLabelClass } from "@/lib/ui-classes"
import { cn } from "@/lib/utils"
import type { Subject } from "@/features/generate/types"
import { Calculator, FlaskConical, Sigma } from "lucide-react"

const subjects: {
  value: Subject
  icon: ComponentType<{ className?: string }>
}[] = [
  { value: "math", icon: Sigma },
  { value: "physics", icon: Calculator },
  { value: "chemistry", icon: FlaskConical },
]

interface SubjectSelectorProps {
  value: Subject | ""
  onChange: (value: Subject) => void
  disabled?: boolean
}

export function SubjectSelector({ value, onChange, disabled }: SubjectSelectorProps) {
  const t = useTranslations("generate")
  const tCommon = useTranslations("common")

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className={formLabelClass}>{t("subject")}</legend>
      <div className="grid grid-cols-3 gap-3 max-lg:gap-4">
        {subjects.map((item) => {
          const Icon = item.icon
          const label = tCommon(`subjects.${item.value}`)
          const isSelected = value === item.value

          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={isSelected}
              aria-label={tCommon("selectSubject", { subject: label })}
              disabled={disabled}
              onClick={() => onChange(item.value)}
              className={cn(
                "flex min-h-28 flex-col items-center justify-center gap-3 rounded-xl border bg-background px-2 py-5 text-lg transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 max-lg:active:scale-[0.98] lg:min-h-24 lg:rounded-xl lg:py-5 lg:text-base",
                isSelected && "border-primary bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              <Icon className="size-8 lg:size-7" />
              <span className="font-semibold lg:font-medium">{label}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

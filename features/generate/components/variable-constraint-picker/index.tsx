"use client"

import { useTranslations } from "next-intl"

import { FindVariableSection } from "@/features/generate/components/variable-constraint-picker/find-variable-section"
import { GivenVariableSection } from "@/features/generate/components/variable-constraint-picker/given-variable-section"
import { shouldShowGivenSection } from "@/features/generate/data/variable-compatibility"

interface VariableConstraintPickerProps {
  lesson: string
  findVariableIds: string[]
  targetRandomize: boolean
  givenVariableIds: string[]
  onFindChange: (ids: string[]) => void
  onTargetRandomizeChange: (enabled: boolean) => void
  onGivenChange: (ids: string[]) => void
  disabled?: boolean
}

export function VariableConstraintPicker({
  lesson,
  findVariableIds,
  targetRandomize,
  givenVariableIds,
  onFindChange,
  onTargetRandomizeChange,
  onGivenChange,
  disabled,
}: VariableConstraintPickerProps) {
  const t = useTranslations("generate")
  const hasLesson = Boolean(lesson.trim())
  const showGiven = shouldShowGivenSection(findVariableIds, targetRandomize)

  if (!hasLesson) {
    return (
      <p className="text-xs text-muted-foreground">{t("selectLessonForVariables")}</p>
    )
  }

  return (
    <div className="space-y-6">
      <FindVariableSection
        lesson={lesson}
        findVariableIds={findVariableIds}
        targetRandomize={targetRandomize}
        onFindChange={onFindChange}
        onTargetRandomizeChange={onTargetRandomizeChange}
        disabled={disabled}
      />

      {showGiven ? (
        <GivenVariableSection
          lesson={lesson}
          findVariableIds={findVariableIds}
          targetRandomize={targetRandomize}
          givenVariableIds={givenVariableIds}
          onGivenChange={onGivenChange}
          disabled={disabled}
        />
      ) : (
        <p className="text-xs text-muted-foreground">{t("chooseFindFirst")}</p>
      )}
    </div>
  )
}

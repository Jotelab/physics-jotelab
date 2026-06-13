"use client"

import { Settings2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { InlineEditableText } from "@/features/worksheet/components/inline-editable-text"
import type { WorksheetHeaderChangeHandlers } from "@/features/worksheet/hooks/use-worksheet-header-config"
import type { ResolvedWorksheetHeader, WorksheetHeaderFieldToggles } from "@/features/worksheet/types/header"
import type { WorksheetViewMode } from "@/features/worksheet/utils"
import { cn } from "@/lib/utils"

type WorksheetEditableHeaderProps = {
  header: ResolvedWorksheetHeader
  viewMode: WorksheetViewMode
  editable?: boolean
  onHeaderChange?: WorksheetHeaderChangeHandlers
}

const fieldToggleKeys = [
  "showStudentName",
  "showDate",
  "showClassSection",
  "showScoreBox",
] as const satisfies ReadonlyArray<keyof WorksheetHeaderFieldToggles>

export function WorksheetEditableHeader({
  header,
  viewMode,
  editable = false,
  onHeaderChange,
}: WorksheetEditableHeaderProps) {
  const t = useTranslations("generate")
  const showStudentFields =
    viewMode === "worksheet" &&
    fieldToggleKeys.some((key) => header.fields[key])

  return (
    <div className="group relative mb-8 shrink-0 border-b pb-5">
      {editable && onHeaderChange ? (
        <div className="absolute right-0 top-0 z-10 opacity-100 transition-opacity duration-150 print:hidden [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
          <HeaderSettingsMenu fields={header.fields} onFieldsChange={onHeaderChange.onFieldsChange} />
        </div>
      ) : null}

      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
        {viewMode === "worksheet" ? t("worksheet") : t("answerKey")}
      </p>

      <h2 className="text-2xl font-semibold tracking-normal">
        <InlineEditableText
          value={header.title}
          editable={editable && Boolean(onHeaderChange)}
          ariaLabel={t("headerTitleEdit")}
          onChange={onHeaderChange?.onTitleChange ?? (() => undefined)}
          className="block"
          inputClassName="text-2xl font-semibold tracking-normal"
        />
      </h2>

      <div className="mt-2 text-sm text-muted-foreground">
        <InlineEditableText
          value={header.instructions}
          editable={editable && Boolean(onHeaderChange)}
          multiline
          ariaLabel={t("headerInstructionsEdit")}
          onChange={onHeaderChange?.onInstructionsChange ?? (() => undefined)}
          className="text-sm text-muted-foreground"
          inputClassName="text-sm text-muted-foreground"
        />
      </div>

      {showStudentFields ? <HeaderFieldsRow fields={header.fields} /> : null}
    </div>
  )
}

function HeaderSettingsMenu({
  fields,
  onFieldsChange,
}: {
  fields: WorksheetHeaderFieldToggles
  onFieldsChange: (fields: WorksheetHeaderFieldToggles) => void
}) {
  const t = useTranslations("generate")

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 text-muted-foreground"
          aria-label={t("headerSettings")}
        >
          <Settings2 className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 print:hidden">
        <PopoverHeader>
          <PopoverTitle>{t("headerSettings")}</PopoverTitle>
        </PopoverHeader>
        <div className="space-y-3 pt-1">
          {fieldToggleKeys.map((key) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <Label htmlFor={`header-toggle-${key}`} className="text-sm font-normal">
                {t(`headerToggle.${key}`)}
              </Label>
              <Switch
                id={`header-toggle-${key}`}
                checked={fields[key]}
                onCheckedChange={(checked) =>
                  onFieldsChange({
                    ...fields,
                    [key]: checked,
                  })
                }
              />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function HeaderFieldsRow({ fields }: { fields: WorksheetHeaderFieldToggles }) {
  const t = useTranslations("generate")

  return (
    <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
      {fields.showStudentName ? (
        <HeaderField label={t("headerName")} blankClassName="min-w-[10rem]" />
      ) : null}
      {fields.showDate ? (
        <HeaderField label={t("headerDate")} blankClassName="min-w-[8rem]" />
      ) : null}
      {fields.showClassSection ? (
        <HeaderField label={t("headerClassSection")} blankClassName="min-w-[10rem]" />
      ) : null}
      {fields.showScoreBox ? (
        <div className="flex items-end gap-2 sm:col-span-2">
          <span className="shrink-0 font-medium">{t("headerScore")}</span>
          <span className={cn("inline-block flex-1 border-b border-foreground/70", "min-w-[4rem] max-w-[6rem]")} />
          <span className="shrink-0 text-muted-foreground">/</span>
          <span className={cn("inline-block flex-1 border-b border-foreground/70", "min-w-[4rem] max-w-[6rem]")} />
        </div>
      ) : null}
    </div>
  )
}

function HeaderField({
  label,
  blankClassName,
}: {
  label: string
  blankClassName: string
}) {
  return (
    <div className="flex items-end gap-2">
      <span className="shrink-0 font-medium">{label}</span>
      <span className={cn("inline-block flex-1 border-b border-foreground/70", blankClassName)} />
    </div>
  )
}

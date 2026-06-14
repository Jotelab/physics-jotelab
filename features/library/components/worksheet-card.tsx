"use client"

import { CalendarDays, MoreHorizontal, Trash2 } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DeleteWorksheetDialog,
  useDeleteWorksheetDialog,
} from "@/features/library/components/delete-worksheet-dialog"
import { touchFieldListItemClass } from "@/lib/ui-classes"
import { cn } from "@/lib/utils"
import type { LibraryWorksheetSummary } from "@/features/library/types"

function MoreMenu({
  worksheetId,
  worksheetTitle,
}: {
  worksheetId: string
  worksheetTitle: string
}) {
  const t = useTranslations("library")
  const tCommon = useTranslations("common")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const deleteDialog = useDeleteWorksheetDialog()

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        variant="ghost"
        size="touch-icon"
        aria-label={tCommon("moreOptions")}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="text-muted-foreground hover:text-foreground"
      >
        <MoreHorizontal />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] overflow-hidden rounded-xl border bg-popover shadow-lg lg:mt-1 lg:min-w-[140px] lg:rounded-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              deleteDialog.openDialog()
            }}
            className={cn(
              touchFieldListItemClass,
              "w-full text-destructive hover:bg-destructive/10"
            )}
          >
            <Trash2 className="size-3.5" />
            {tCommon("delete")}
          </button>
        </div>
      )}

      <DeleteWorksheetDialog
        worksheetId={worksheetId}
        worksheetTitle={worksheetTitle}
        open={deleteDialog.open}
        onOpenChange={deleteDialog.setOpen}
      />
    </div>
  )
}

export function WorksheetCard({
  worksheet,
}: {
  worksheet: LibraryWorksheetSummary
}) {
  const t = useTranslations("library")
  const locale = useLocale()
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [locale]
  )

  const isIncomplete =
    worksheet.actualQuestionCount < worksheet.expectedQuestionCount

  return (
    <article className="group relative">
      <Link
        href={`/library/${worksheet.id}`}
        className="flex aspect-[1/1.414] w-full flex-col rounded-xl border bg-background shadow-sm transition-all duration-200 hover:border-foreground/30 hover:shadow-md"
      >
        <div className="flex-1" />

        <div className="p-4 pt-4 md:p-6 md:pt-4">
          {isIncomplete && (
            <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-lg text-amber-700">
              {t("incomplete", {
                actual: worksheet.actualQuestionCount,
                expected: worksheet.expectedQuestionCount,
              })}
            </p>
          )}
          <h2 className="line-clamp-2 text-3xl font-semibold leading-snug tracking-normal">
            {worksheet.title}
          </h2>
          <div className="mt-3 flex items-center gap-3 text-lg text-muted-foreground">
            <span>{t("questions", { count: worksheet.actualQuestionCount })}</span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {dateFormatter.format(new Date(worksheet.createdAt))}
            </span>
          </div>
        </div>
      </Link>

      <div className="absolute right-1.5 top-1.5 opacity-100 transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
        <MoreMenu worksheetId={worksheet.id} worksheetTitle={worksheet.title} />
      </div>
    </article>
  )
}

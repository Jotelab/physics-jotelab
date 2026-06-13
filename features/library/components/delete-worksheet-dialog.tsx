"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useFormStatus } from "react-dom"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { deleteWorksheetAction } from "@/features/library/actions"

export function DeleteWorksheetDialog({
  worksheetId,
  worksheetTitle,
  open,
  onOpenChange,
}: {
  worksheetId: string
  worksheetTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("library")
  const tCommon = useTranslations("common")

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteDescription", { title: worksheetTitle })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <form action={deleteWorksheetAction} className="contents">
            <input type="hidden" name="worksheetId" value={worksheetId} />
            <AlertDialogAction asChild>
              <DeleteConfirmButton worksheetTitle={worksheetTitle} />
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeleteConfirmButton({ worksheetTitle }: { worksheetTitle: string }) {
  const { pending } = useFormStatus()
  const tCommon = useTranslations("common")

  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={pending}
      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
    >
      {pending ? tCommon("deleting") : tCommon("delete")}
      <span className="sr-only">{worksheetTitle}</span>
    </Button>
  )
}

export function useDeleteWorksheetDialog() {
  const [open, setOpen] = useState(false)

  return {
    open,
    setOpen,
    openDialog: () => setOpen(true),
    closeDialog: () => setOpen(false),
  }
}

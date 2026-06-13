"use client"

import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DeleteWorksheetDialog,
  useDeleteWorksheetDialog,
} from "@/features/library/components/delete-worksheet-dialog"

export function DeleteWorksheetButton({
  worksheetId,
  worksheetTitle,
}: {
  worksheetId: string
  worksheetTitle: string
}) {
  const deleteDialog = useDeleteWorksheetDialog()

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={deleteDialog.openDialog}
        aria-label={`Delete ${worksheetTitle}`}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
      <DeleteWorksheetDialog
        worksheetId={worksheetId}
        worksheetTitle={worksheetTitle}
        open={deleteDialog.open}
        onOpenChange={deleteDialog.setOpen}
      />
    </>
  )
}

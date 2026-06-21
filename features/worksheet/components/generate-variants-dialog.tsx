"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type GenerateVariantsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  questionCount: number
  creditBalance: number
  isSubmitting: boolean
  onConfirm: (additionalCount: number) => void
}

export function GenerateVariantsDialog({
  open,
  onOpenChange,
  questionCount,
  creditBalance,
  isSubmitting,
  onConfirm,
}: GenerateVariantsDialogProps) {
  const t = useTranslations("generate")
  const [additionalCount, setAdditionalCount] = useState(1)

  const creditCost = additionalCount * questionCount
  const canAfford = creditBalance >= creditCost

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("generateVariants")}</DialogTitle>
          <DialogDescription>{t("generateVariantsDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm font-medium">{t("variantCountLabel")}</p>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((count) => {
              const totalVersions = count + 1
              const selected = additionalCount === count

              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => setAdditionalCount(count)}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    selected
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {t("variantCountOption", { total: totalVersions })}
                </button>
              )
            })}
          </div>

          <p className="text-sm text-muted-foreground">
            {t("variantCreditPreview", { cost: creditCost, count: questionCount })}
          </p>

          {!canAfford ? (
            <p className="text-sm text-destructive">{t("variantInsufficientCredits")}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("variantCancel")}
          </Button>
          <Button
            type="button"
            disabled={!canAfford || isSubmitting}
            onClick={() => onConfirm(additionalCount)}
          >
            {isSubmitting ? t("generatingVariants") : t("confirmGenerateVariants")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type UnsavedVariantsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmLeave: () => void
}

export function UnsavedVariantsDialog({
  open,
  onOpenChange,
  onConfirmLeave,
}: UnsavedVariantsDialogProps) {
  const t = useTranslations("generate")

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("variantsUnsavedWarningTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("variantsUnsavedWarning")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("variantCancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmLeave}>{t("leaveWithoutSaving")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

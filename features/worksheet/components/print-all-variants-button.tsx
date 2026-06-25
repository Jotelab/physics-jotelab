"use client"

import { Printer } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

export function PrintAllVariantsButton({
  disabled,
  onClick,
}: {
  disabled?: boolean
  onClick?: () => void
}) {
  const t = useTranslations("generate")

  return (
    <Button
      type="button"
      variant="outline"
      size="touch"
      className="print:hidden"
      disabled={disabled}
      onClick={onClick ?? (() => window.print())}
    >
      <Printer className="size-4" />
      {t("printAllVersions")}
    </Button>
  )
}

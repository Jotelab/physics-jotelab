"use client"

import { Printer } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

export function ExportPdfButton() {
  const t = useTranslations("worksheet")

  return (
    <Button
      type="button"
      variant="outline"
      size="touch"
      className="print:hidden"
      onClick={() => window.print()}
    >
      <Printer className="size-4" />
      {t("exportPdf")}
    </Button>
  )
}

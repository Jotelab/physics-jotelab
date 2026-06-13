import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { SavedWorksheetViewer } from "@/features/library/components/saved-worksheet-viewer"
import { getLibraryWorksheet } from "@/features/library/data"

type PageProps = { params: Promise<{ worksheetId: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { worksheetId } = await params
  const worksheet = await getLibraryWorksheet(worksheetId)
  const t = await getTranslations("metadata")

  return {
    title: worksheet?.title ?? t("worksheetTitle"),
    description: worksheet
      ? t("worksheetDescription", { title: worksheet.title })
      : undefined,
  }
}

export default async function LibraryWorksheetPage({
  params,
}: {
  params: Promise<{ worksheetId: string }>
}) {
  const { worksheetId } = await params
  const worksheet = await getLibraryWorksheet(worksheetId)
  const t = await getTranslations("library")

  if (!worksheet) {
    notFound()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b bg-background px-6 py-3 print:hidden">
        <Button asChild variant="outline" size="touch">
          <Link href="/library">{t("backToLibrary")}</Link>
        </Button>
      </div>
      <SavedWorksheetViewer worksheet={worksheet} />
    </div>
  )
}

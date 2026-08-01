import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { InclinedPlaneDoodle } from "@/components/doodles"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { WorksheetCard } from "@/features/library/components/worksheet-card"
import { getLibraryWorksheets } from "@/features/library/data"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata")

  return {
    title: t("libraryTitle"),
    description: t("libraryDescription"),
  }
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const t = await getTranslations("library")

  const { worksheets, hasMore } = await getLibraryWorksheets(page)

  const prevHref = page > 1 ? `/library?page=${page - 1}` : null
  const nextHref = hasMore ? `/library?page=${page + 1}` : null

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {worksheets.length === 0 && page === 1 ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-md border border-dashed bg-muted/10 p-8 text-center text-sm text-muted-foreground">
          <InclinedPlaneDoodle />
          <p>
            {t("emptyFirst")}{" "}
            <Link href="/generate" className="underline underline-offset-4">
              {t("generateFirst")}
            </Link>
          </p>
        </div>
      ) : worksheets.length === 0 ? (
        <div className="flex min-h-72 items-center justify-center rounded-md border border-dashed bg-muted/10 p-8 text-center text-sm text-muted-foreground">
          {t("emptyPage")}{" "}
          <Link href="/library" className="ml-1 underline underline-offset-4">
            {t("backToPageOne")}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {worksheets.map((worksheet) => (
              <WorksheetCard key={worksheet.id} worksheet={worksheet} />
            ))}
          </div>

          {(prevHref || nextHref) && (
            <div className="flex items-center justify-between border-t pt-4">
              {prevHref ? (
                <Button asChild variant="outline">
                  <Link href={prevHref}>← {t("previous")}</Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted-foreground">{t("page", { page })}</span>
              {nextHref ? (
                <Button asChild variant="outline">
                  <Link href={nextHref}>{t("next")} →</Link>
                </Button>
              ) : (
                <span />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

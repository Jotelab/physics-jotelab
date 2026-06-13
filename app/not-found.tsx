import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"
import { PageState } from "@/components/ui/page-state"

export default async function NotFound() {
  const t = await getTranslations("errors")
  const tCommon = await getTranslations("common")

  return (
    <main className="min-h-screen bg-muted/10">
      <PageState
        title={t("pageNotFound")}
        description={t("pageNotFoundDescription")}
        className="min-h-screen"
        action={
          <Button asChild variant="outline">
            <Link href="/generate">
              <ArrowLeft className="size-4" />
              {tCommon("goToGenerate")}
            </Link>
          </Button>
        }
      />
    </main>
  )
}

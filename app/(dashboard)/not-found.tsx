import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"
import { PageState } from "@/components/ui/page-state"

export default async function DashboardNotFound() {
  const t = await getTranslations("errors")
  const tCommon = await getTranslations("common")

  return (
    <PageState
      title={t("pageNotFound")}
      description={t("pageNotFoundDescription")}
      action={
        <Button asChild variant="outline">
          <Link href="/generate">
            <ArrowLeft className="size-4" />
            {tCommon("goToGenerate")}
          </Link>
        </Button>
      }
    />
  )
}

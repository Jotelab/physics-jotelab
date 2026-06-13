"use client"

import { useEffect } from "react"
import { RotateCcw } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { PageState } from "@/components/ui/page-state"

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const t = useTranslations("errors")
  const tCommon = useTranslations("common")

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PageState
      title={t("pageLoadFailed")}
      description={t("pageLoadFailedDescription")}
      action={
        <Button type="button" onClick={() => unstable_retry()}>
          <RotateCcw className="size-4" />
          {tCommon("tryAgain")}
        </Button>
      }
    />
  )
}

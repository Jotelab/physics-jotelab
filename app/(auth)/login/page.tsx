import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { SpringDoodle } from "@/components/doodles"
import { Button } from "@/components/ui/button"
import { signInWithGoogleAction } from "@/features/auth/actions"
import { cardClass, pageTitleClass } from "@/lib/ui-classes"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata")

  return {
    title: t("loginTitle"),
    description: t("loginDescription"),
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/generate")
  }

  const t = await getTranslations("auth")
  const tCommon = await getTranslations("common")
  const tErrors = await getTranslations("errors")
  const loginErrorMessage =
    error === "profile"
      ? tErrors("PROFILE_NOT_FOUND")
      : error === "oauth"
        ? t("loginErrorOauth")
        : error === "callback"
          ? t("loginErrorCallback")
          : error
            ? tErrors("UNKNOWN")
            : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/10">
      <div className={cn(cardClass, "w-full max-w-sm text-center")}>
        <div className="mb-2 flex justify-center">
          <SpringDoodle />
        </div>
        <h1 className={cn(pageTitleClass, "mb-2")}>{tCommon("appName")}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t("tagline")}</p>
        {loginErrorMessage ? (
          <div
            className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-left text-sm text-destructive"
            role="alert"
          >
            <p className="font-medium">{loginErrorMessage}</p>
          </div>
        ) : null}
        <form action={signInWithGoogleAction}>
          <Button type="submit" size="touch-wide">
            {t("loginWithGoogle")}
          </Button>
        </form>
      </div>
    </div>
  )
}

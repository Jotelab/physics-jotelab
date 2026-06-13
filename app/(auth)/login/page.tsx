import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

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

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/generate")
  }

  const t = await getTranslations("auth")
  const tCommon = await getTranslations("common")

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/10">
      <div className={cn(cardClass, "w-full max-w-sm text-center")}>
        <h1 className={cn(pageTitleClass, "mb-2")}>{tCommon("appName")}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t("tagline")}</p>
        <form action={signInWithGoogleAction}>
          <Button type="submit" size="touch-wide">
            {t("loginWithGoogle")}
          </Button>
        </form>
      </div>
    </div>
  )
}

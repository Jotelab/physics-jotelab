import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signInWithGoogleAction } from "@/features/auth/actions"
import { devPasswordLoginEnabled } from "@/features/auth/dev-login-enabled"
import { signInWithDevPasswordAction } from "@/features/auth/dev-login"
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
          : error === "dev_credentials"
            ? "Invalid email or password (dev sign-in)."
            : error
              ? tErrors("UNKNOWN")
              : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/10">
      <div className={cn(cardClass, "w-full max-w-sm text-center")}>
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
        {devPasswordLoginEnabled() ? (
          /* Local-stack only (DEV_PASSWORD_LOGIN=true): password sign-in
             against a local Supabase — never rendered on deployed envs. */
          <form
            action={signInWithDevPasswordAction}
            className="mt-6 space-y-2 border-t pt-4 text-left"
          >
            <p className="text-xs font-medium text-muted-foreground">
              Dev sign-in (local Supabase)
            </p>
            <Input name="email" type="email" placeholder="email" required />
            <Input
              name="password"
              type="password"
              placeholder="password"
              required
            />
            <Button type="submit" variant="outline" size="touch-wide">
              Sign in with password
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  )
}

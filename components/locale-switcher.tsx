"use client"

import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { setLocaleAction } from "@/features/i18n/actions"
import { locales, type Locale } from "@/i18n/config"
import { cn } from "@/lib/utils"

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale
  const router = useRouter()
  const t = useTranslations("common")
  const [isPending, startTransition] = useTransition()

  function handleChange(nextLocale: Locale) {
    if (nextLocale === locale) {
      return
    }

    startTransition(async () => {
      await setLocaleAction(nextLocale)
      router.refresh()
    })
  }

  return (
    <div className={cn("flex items-center gap-1", className)} role="group" aria-label={t("language")}>
      {locales.map((value) => (
        <button
          key={value}
          type="button"
          disabled={isPending}
          onClick={() => handleChange(value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === locale
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {value === "en" ? t("english") : t("thai")}
        </button>
      ))}
    </div>
  )
}

"use client"

import { useTranslations } from "next-intl"

import { LocaleSwitcher } from "@/components/locale-switcher"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { cardClass, formLabelClass, sectionTitleClass } from "@/lib/ui-classes"
import { cn } from "@/lib/utils"

export function PreferencesPanel() {
  const t = useTranslations("settings")
  const tCommon = useTranslations("common")

  return (
    <section>
      <h2 className={sectionTitleClass}>{t("preferences")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("languageDescription")}</p>

      <div className={cn(cardClass, "mt-6")}>
        <p className={cn(formLabelClass, "mb-3")}>{tCommon("language")}</p>
        <LocaleSwitcher />
      </div>

      <div className={cn(cardClass, "mt-6")}>
        <p className={cn(formLabelClass, "mb-1")}>{t("appearance")}</p>
        <p className="mb-3 text-sm text-muted-foreground">{t("themeDescription")}</p>
        <ThemeSwitcher />
      </div>
    </section>
  )
}

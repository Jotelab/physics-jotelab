"use client"

import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import { useSyncExternalStore } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const themes = ["light", "dark", "system"] as const

type Theme = (typeof themes)[number]

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const t = useTranslations("settings")
  const mounted = useSyncExternalStore(
    (cb) => { cb(); return () => {}; },
    () => true,
    () => false
  )

  if (!mounted) {
    return (
      <Select disabled>
        <SelectTrigger className={className ?? "w-full max-w-xs"}>
          <SelectValue />
        </SelectTrigger>
      </Select>
    )
  }

  const themeLabels: Record<Theme, string> = {
    light: t("themeLight"),
    dark: t("themeDark"),
    system: t("themeSystem"),
  }

  return (
    <Select
      value={(theme as Theme) ?? "system"}
      onValueChange={(value) => setTheme(value)}
    >
      <SelectTrigger className={className ?? "w-full max-w-xs"} aria-label={t("appearance")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {themes.map((value) => (
          <SelectItem key={value} value={value}>
            {themeLabels[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

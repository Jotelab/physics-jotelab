import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PreferencesPanel } from "@/components/settings/preferences-panel"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata")

  return {
    title: t("settingsTitle"),
    description: t("settingsDescription"),
  }
}

export default function SettingsPage() {
  return <PreferencesPanel />
}

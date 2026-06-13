import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { GenerateConfigSummary } from "@/features/generate/components/generate-config-summary"
import { GenerateWorkspace } from "@/features/generate/components/generate-workspace"
import { getUserProfile } from "@/features/auth/get-user-profile"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata")

  return {
    title: t("generateTitle"),
    description: t("generateDescription"),
  }
}

export default async function GeneratePage() {
  const profile = await getUserProfile()
  const creditBalance = profile?.credit_balance ?? 0

  return (
    <GenerateWorkspace creditBalance={creditBalance}>
      <GenerateConfigSummary />
    </GenerateWorkspace>
  )
}

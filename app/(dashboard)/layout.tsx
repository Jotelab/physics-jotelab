import { getTranslations } from "next-intl/server"

import { DashboardShell } from "@/components/layout/dashboard-shell"
import { getUserProfile } from "@/features/auth/get-user-profile"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const profile = await getUserProfile()
  const t = await getTranslations("common")

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {t("skipToMain")}
      </a>
      <DashboardShell profile={profile}>{children}</DashboardShell>
    </>
  )
}

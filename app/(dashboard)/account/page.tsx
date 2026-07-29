import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { UserCircle } from "lucide-react"
import Image from "next/image"

import { PageHeader } from "@/components/layout/page-header"
import { cardClass } from "@/lib/ui-classes"
import { getUserProfile } from "@/features/auth/get-user-profile"
import { CoachProgressCard } from "@/features/coach/components/coach-progress-card"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata")

  return {
    title: t("accountTitle"),
    description: t("accountDescription"),
  }
}

export default async function AccountPage() {
  const profile = await getUserProfile()
  const t = await getTranslations("account")
  const tCommon = await getTranslations("common")

  const displayName = profile?.display_name ?? tCommon("user")
  const email = profile?.email ?? ""
  const initial = (displayName || email || "U").slice(0, 1).toUpperCase()

  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt=""
                width={64}
                height={64}
                unoptimized
                className="size-16 rounded-full border object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full border bg-muted text-xl font-semibold">
                {initial || <UserCircle className="size-7 text-muted-foreground" />}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-normal">{displayName}</h2>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 px-4 py-3">
            <p className="text-sm text-muted-foreground">{t("credits")}</p>
            <p className="mt-1 text-2xl font-semibold">{profile?.credit_balance ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <CoachProgressCard />
      </div>
    </div>
  )
}

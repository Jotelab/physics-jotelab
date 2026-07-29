"use client"

import { useEffect, useRef, useState } from "react"
import { Menu } from "lucide-react"
import { useTranslations } from "next-intl"

import { Sidebar, SidebarDrawer } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import type { UserProfile } from "@/features/auth/types"
import { cn } from "@/lib/utils"

export function DashboardShell({
  profile,
  children,
}: {
  profile?: UserProfile | null
  children: React.ReactNode
}) {
  const t = useTranslations("common")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!drawerOpen) return

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false)
      }
    }

    document.addEventListener("keydown", handleKey)
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKey)
      document.documentElement.style.overflow = previousOverflow
    }
  }, [drawerOpen])

  // print: the viewport clamp (100dvh + nested overflow) would truncate the
  // printed worksheet to a single page — unclamp the whole shell chain.
  return (
    <div className="flex h-[100dvh] overflow-hidden print:h-auto print:overflow-visible">
      <Sidebar profile={profile} />

      <SidebarDrawer
        profile={profile}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        returnFocusRef={menuButtonRef}
      />

      {drawerOpen && (
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/50 lg:hidden print:hidden"
          )}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <main
        id="main-content"
        aria-label={t("mainContent")}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto print:overflow-visible"
      >
        <div className="sticky top-0 z-30 flex h-[4.5rem] shrink-0 items-center gap-4 border-b bg-background/95 px-5 backdrop-blur lg:hidden print:hidden">
          <Button
            ref={menuButtonRef}
            type="button"
            variant="ghost"
            size="touch-icon"
            onClick={() => setDrawerOpen(true)}
            className="shrink-0 text-muted-foreground"
            aria-label={t("openMenu")}
            aria-expanded={drawerOpen}
            aria-controls="mobile-navigation-drawer"
          >
            <Menu className="size-7 lg:size-4" />
          </Button>
          <span className="text-xl font-semibold">{t("appName")}</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col" {...(drawerOpen ? { inert: true } : {})}>
          {children}
        </div>
      </main>
    </div>
  )
}

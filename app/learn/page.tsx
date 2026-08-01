import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardShell } from "@/components/layout/dashboard-shell"
import { PageHeader } from "@/components/layout/page-header"
import { getUserProfileOrNull } from "@/features/auth/get-user-profile-or-null"
import { generateCoachProblem } from "@/features/coach/actions"
import { CoachProgressCard } from "@/features/coach/components/coach-progress-card"
import { CoachSession } from "@/features/coach/components/coach-session"
import { fetchRecentErrorTypes } from "@/features/coach/recent-errors"
import { cardClass } from "@/lib/ui-classes"

/**
 * The Application-as-Teacher surface (DEVELOPMENT_PLAN C1): a student solves an
 * engine-generated SUVAT problem in three checked steps, with the engine —
 * never an LLM — judging every input.
 *
 * Deliberately **outside** the `(dashboard)` route group, because that group's
 * layout redirects anonymous visitors to `/login`, and a coached solve needs no
 * account, no credits, and no Supabase — only the engine. That keeps the demo
 * path to a single dependency and the neuro-symbolic invariant self-evident.
 *
 * It still renders {@link DashboardShell} itself, so the page is part of the app
 * rather than a detached island: same sidebar, same mobile drawer, same header
 * and container widths as `/generate` and `/library`. The profile is loaded
 * defensively ({@link getUserProfileOrNull}) — signed-in students get their
 * usual chrome, anonymous ones get the same chrome without profile details, and
 * neither gets an error page.
 *
 * Thai copy is hardcoded here, matching the rest of the coach surface.
 */

export const metadata: Metadata = {
  title: "ฝึกทำโจทย์ทีละขั้น | Jotelab",
  description:
    "แก้โจทย์ฟิสิกส์ทีละขั้นโดยมีระบบตรวจทุกขั้นตอนจากเอนจินสัญลักษณ์ — เลือกสมการ แทนค่า และคำนวณคำตอบ",
}

export const dynamic = "force-dynamic"

export default async function LearnPage() {
  const [result, recentErrors, profile, tCommon] = await Promise.all([
    generateCoachProblem(),
    // Anonymous solves get [] — remediation then relies on this session alone.
    fetchRecentErrorTypes(),
    getUserProfileOrNull(),
    getTranslations("common"),
  ])

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {tCommon("skipToMain")}
      </a>

      <DashboardShell profile={profile}>
        <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
          <PageHeader
            title="ฝึกทำโจทย์ทีละขั้น"
            description="ระบบจะตรวจทุกขั้นตอนของคุณกับคำตอบที่คำนวณโดยเอนจินสัญลักษณ์ — ตอบผิดจะได้คำใบ้ที่ตรงกับจุดที่พลาด ไม่ใช่เฉลยทันที และโจทย์ข้อถัดไปจะถูกเลือกจากจุดที่คุณเพิ่งพลาด"
          />

          {result.ok ? (
            <div className="space-y-8">
              <CoachSession
                initial={result.sympyData}
                initialDiagramSvg={result.diagramSvg}
                priorErrors={recentErrors}
              />
              {/* Renders null for anonymous solves, so the page stays account-free. */}
              <CoachProgressCard />
            </div>
          ) : (
            <div className={cardClass}>
              <p className="font-medium text-destructive">ยังเชื่อมต่อเอนจินไม่ได้</p>
              <p className="mt-1 text-sm text-muted-foreground">{result.error}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                ตรวจสอบว่า engine service ทำงานอยู่ และตั้งค่า{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  ENGINE_BASE_URL
                </code>{" "}
                /{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  ENGINE_API_KEY
                </code>{" "}
                แล้ว
              </p>
            </div>
          )}
        </div>
      </DashboardShell>
    </>
  )
}

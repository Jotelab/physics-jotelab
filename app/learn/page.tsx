import type { Metadata } from "next"
import Link from "next/link"

import { generateCoachProblem } from "@/features/coach/actions"
import { CoachProgressCard } from "@/features/coach/components/coach-progress-card"
import { CoachSession } from "@/features/coach/components/coach-session"

/**
 * The Application-as-Teacher surface (DEVELOPMENT_PLAN C1): a student solves an
 * engine-generated SUVAT problem in three checked steps, with the engine —
 * never an LLM — judging every input.
 *
 * Deliberately outside the `(dashboard)` group: a coached solve needs no
 * account, no credits, and no Supabase — only the engine service. That keeps
 * the demo path to a single dependency and the neuro-symbolic invariant
 * self-evident.
 */

export const metadata: Metadata = {
  title: "ฝึกทำโจทย์ทีละขั้น | Jotelab",
  description:
    "แก้โจทย์ฟิสิกส์ทีละขั้นโดยมีระบบตรวจทุกขั้นตอนจากเอนจินสัญลักษณ์ — เลือกสมการ แทนค่า และคำนวณคำตอบ",
}

export const dynamic = "force-dynamic"

export default async function LearnPage() {
  const result = await generateCoachProblem()

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <Link
          href="/generate"
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          ← กลับไปหน้าสร้างใบงาน
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">ฝึกทำโจทย์ทีละขั้น</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ระบบจะตรวจทุกขั้นตอนของคุณกับคำตอบที่คำนวณโดยเอนจินสัญลักษณ์ —
          ตอบผิดจะได้คำใบ้ที่ตรงกับจุดที่พลาด ไม่ใช่เฉลยทันที
          และโจทย์ข้อถัดไปจะถูกเลือกจากจุดที่คุณเพิ่งพลาด
        </p>
      </header>
      {result.ok ? (
        <>
          <CoachSession
            initial={result.sympyData}
            initialDiagramSvg={result.diagramSvg}
          />
          {/* Renders null for anonymous solves, so the page stays account-free. */}
          <div className="mt-8">
            <CoachProgressCard />
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">ยังเชื่อมต่อเอนจินไม่ได้</p>
          <p className="mt-1 text-muted-foreground">{result.error}</p>
          <p className="mt-2 text-muted-foreground">
            ตรวจสอบว่า engine service ทำงานอยู่ และตั้งค่า{" "}
            <code>ENGINE_BASE_URL</code> / <code>ENGINE_API_KEY</code> แล้ว
          </p>
        </div>
      )}
    </main>
  )
}

import Link from "next/link"

import { cardClass } from "@/lib/ui-classes"
import { createClient } from "@/lib/supabase/server"

import { summarizeAttempts, type CoachingAttemptRow } from "../progress"
import type { CoachErrorType } from "../types"

/**
 * Minimal coaching progress view (C1.3): problems solved and the student's
 * common error types, from their own `coaching_attempts` rows (RLS-scoped
 * select; writes go through the `record_coaching_attempt` RPC). Renders
 * nothing when the query fails so the account page never breaks on a missing
 * table or connection.
 */

/** Learner-facing Thai names, matching the coach surface's hardcoded-Thai convention. */
const ERROR_LABELS: Record<CoachErrorType, string> = {
  "wrong-equation": "เลือกสมการไม่ตรงกับโจทย์",
  "swapped-variables": "แทนค่าสลับตัวแปร",
  "sign-error": "เครื่องหมายบวกลบผิด",
  "unit-slip": "หน่วยคลาดเคลื่อน",
  "arithmetic-slip": "คิดเลขพลาด",
  "value-slip": "แทนค่าไม่ตรงโจทย์",
}

const RECENT_ATTEMPT_LIMIT = 500

export async function CoachProgressCard() {
  let rows: CoachingAttemptRow[]
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("coaching_attempts")
      .select("question_key, step, error_type, solved")
      .order("created_at", { ascending: false })
      .limit(RECENT_ATTEMPT_LIMIT)
    if (error) return null
    rows = (data ?? []) as CoachingAttemptRow[]
  } catch {
    return null
  }

  const summary = summarizeAttempts(rows)

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">การฝึกทำโจทย์ทีละขั้น</h2>
          {summary.attempts === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              ยังไม่มีประวัติการฝึก —{" "}
              <Link href="/learn" className="underline underline-offset-2">
                เริ่มฝึกข้อแรก
              </Link>
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              ตรวจไปแล้ว {summary.attempts} ครั้ง
            </p>
          )}
        </div>
        <div className="rounded-md border bg-muted/20 px-4 py-3 text-right">
          <p className="text-sm text-muted-foreground">โจทย์ที่ทำสำเร็จ</p>
          <p className="mt-1 text-2xl font-semibold">{summary.problemsSolved}</p>
        </div>
      </div>

      {summary.topErrors.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium">จุดที่พลาดบ่อย</p>
          <ul className="mt-2 space-y-1">
            {summary.topErrors.map((error) => (
              <li
                key={error.errorType}
                className="flex items-center justify-between text-sm text-muted-foreground"
              >
                <span>{ERROR_LABELS[error.errorType]}</span>
                <span>{error.count} ครั้ง</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

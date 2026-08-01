"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

const PHRASE_KEYS = ["solving", "converting", "aligning", "checking"] as const

const PHRASE_INTERVAL_MS = 2600

/**
 * Damped-looking pendulum with rotating "lab notebook" phrases, shown while
 * a worksheet is being generated or the preview panel is loading.
 * Swing pauses entirely under prefers-reduced-motion (see globals.css).
 */
export function PhysicsLoader({ className }: { className?: string }) {
  const t = useTranslations("loader")
  const [phraseIndex, setPhraseIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setPhraseIndex((index) => (index + 1) % PHRASE_KEYS.length)
    }, PHRASE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      role="status"
      className={cn("flex flex-col items-center gap-4 p-6", className)}
    >
      <svg
        width="132"
        height="116"
        viewBox="0 0 132 116"
        fill="none"
        aria-hidden="true"
        className="text-foreground/70"
      >
        {/* ceiling mount with hatching */}
        <line x1="36" y1="10" x2="96" y2="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <line x1="44" y1="10" x2="38" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="58" y1="10" x2="52" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="72" y1="10" x2="66" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="86" y1="10" x2="80" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* swing arc guide */}
        <path
          d="M 28 82 A 68 68 0 0 1 104 82"
          stroke="var(--border)"
          strokeWidth="2"
          strokeDasharray="1 8"
          strokeLinecap="round"
        />
        {/* rod + bob swing about the pivot */}
        <g className="animate-pendulum" style={{ transformOrigin: "66px 10px" }}>
          <line x1="66" y1="10" x2="66" y2="86" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="66" cy="96" r="13" fill="var(--chart-2)" fillOpacity="0.85" stroke="currentColor" strokeWidth="2.5" />
        </g>
        <circle cx="66" cy="10" r="3.5" fill="currentColor" />
      </svg>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {t(PHRASE_KEYS[phraseIndex])}
      </p>
    </div>
  )
}

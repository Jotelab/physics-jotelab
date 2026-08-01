import { cn } from "@/lib/utils"

/**
 * Hand-drawn-style physics doodles for empty, error, and login states.
 * One shared stroke language (2.5px, round caps) so they read as one hand;
 * accents use the chart palette (periwinkle --chart-2, gold --chart-4).
 * Decorative only — every doodle is aria-hidden and must never appear in
 * print output (wrap placements in print:hidden where the parent prints).
 */

type DoodleProps = {
  className?: string
}

/** Block with a face resting on an incline — for the empty library. */
export function InclinedPlaneDoodle({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 140 100"
      width="140"
      height="100"
      fill="none"
      aria-hidden="true"
      className={cn("text-foreground/60", className)}
    >
      {/* ground + incline */}
      <path d="M8 89 Q 70 87.5 132 89" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 88 Q 64 60 112 33 L 112 88 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      {/* angle arc + θ */}
      <path d="M40 88 A 22 22 0 0 0 37 76" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <text x="46" y="82" fontSize="11" fill="currentColor" fontFamily="var(--font-heading)">
        θ
      </text>
      {/* block with a face, sitting on the slope */}
      <g transform="rotate(-30 72 55)">
        <rect x="56" y="42" width="32" height="26" rx="6" fill="var(--chart-4)" fillOpacity="0.25" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="67" cy="53" r="1.8" fill="currentColor" />
        <circle cx="77" cy="53" r="1.8" fill="currentColor" />
        <path d="M66 59 Q 72 63 78 59" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* effort arrow up the slope */}
      <path d="M34 80 L 64 63" stroke="var(--chart-2)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M58 62 L 64 63 L 62 69" stroke="var(--chart-2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Mass bouncing on a spring — for the login card. */
export function SpringDoodle({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 120 112"
      width="120"
      height="112"
      fill="none"
      aria-hidden="true"
      className={cn("text-foreground/60", className)}
    >
      {/* ceiling with hatching */}
      <line x1="30" y1="10" x2="90" y2="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="42" y1="10" x2="36" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="58" y1="10" x2="52" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="74" y1="10" x2="68" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* coil */}
      <path
        d="M60 10 L60 18 L46 24 L74 32 L46 40 L74 48 L46 56 L60 62 L60 68"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* mass with a face */}
      <rect x="42" y="68" width="36" height="30" rx="7" fill="var(--chart-2)" fillOpacity="0.25" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="54" cy="80" r="1.8" fill="currentColor" />
      <circle cx="66" cy="80" r="1.8" fill="currentColor" />
      <path d="M53 87 Q 60 91 67 87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** A page escaping the observable universe — for 404 states. */
export function EscapedPageDoodle({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 150 110"
      width="150"
      height="110"
      fill="none"
      aria-hidden="true"
      className={cn("text-foreground/60", className)}
    >
      {/* the observable universe */}
      <circle cx="58" cy="62" r="40" stroke="currentColor" strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" />
      <circle cx="46" cy="52" r="2" fill="currentColor" />
      <circle cx="70" cy="76" r="2" fill="currentColor" />
      <path d="M60 58 l3 3 M63 58 l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* escape trajectory */}
      <path d="M74 34 Q 96 18 116 16" stroke="var(--chart-2)" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />
      {/* the escaped page */}
      <g transform="rotate(14 126 18)">
        <path d="M118 6 L130 6 L136 12 L136 30 L118 30 Z" fill="var(--chart-4)" fillOpacity="0.2" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M130 6 L130 12 L136 12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <line x1="122" y1="17" x2="132" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="122" y1="22" x2="130" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/** Pendulum at rest — for the idle worksheet preview. */
export function PendulumDoodle({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 100 86"
      width="100"
      height="86"
      fill="none"
      aria-hidden="true"
      className={cn("text-foreground/60", className)}
    >
      <line x1="26" y1="8" x2="74" y2="8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="38" y1="8" x2="32" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="54" y1="8" x2="48" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="70" y1="8" x2="64" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 62 A 46 46 0 0 1 78 62" stroke="var(--border)" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />
      <line x1="50" y1="8" x2="50" y2="60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="68" r="10" fill="var(--chart-2)" fillOpacity="0.25" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="50" cy="8" r="3" fill="currentColor" />
    </svg>
  )
}

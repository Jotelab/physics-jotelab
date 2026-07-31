/**
 * Demo-mode guard rails.
 *
 * Some switches make the app produce content that *looks* engine-generated but
 * is not: `E2E_STUB_GENERATION` returns a fixed stub so Playwright can run
 * without the engine, and `GENERATION_MODE=llm_only` lets the model compute
 * numbers. Each exists for a good reason, and each is silent — nothing in a
 * running app distinguishes a stubbed worksheet from a real one.
 *
 * (A third switch, `SHOWCASE_PRESET`, served a curated hand-authored bank for
 * demos. It was removed rather than guarded: a setting whose whole purpose is
 * to be indistinguishable from real output does not belong in a submission.)
 *
 * That silence is the risk: the project's entire claim is that every number
 * comes from the symbolic engine, so a demo given on a stubbed configuration
 * misrepresents the system without anyone intending it. This module makes the
 * state loud where it costs nothing (server logs) and fatal where it would
 * matter most (a production build or boot).
 *
 * Pure and env-injected so the rules are testable without touching
 * `process.env`; see `instrumentation.ts` (startup warning) and
 * `next.config.ts` (build/boot refusal) for the wiring.
 */

export type DemoFlag = {
  /** Environment variable name. */
  key: string
  /** What it actually does to the content a user sees. */
  effect: string
}

type Env = Record<string, string | undefined>

function isEnabled(value: string | undefined): boolean {
  return value === "true"
}

/**
 * Every setting currently making the app deviate from "engine computes
 * everything", plus an unconfigured engine (which makes engine-backed lessons
 * fail closed rather than render).
 */
export function activeDemoFlags(env: Env): DemoFlag[] {
  const flags: DemoFlag[] = []

  if (isEnabled(env.E2E_STUB_GENERATION)) {
    flags.push({
      key: "E2E_STUB_GENERATION",
      effect:
        "generation returns a fixed stub question — no engine call, no model call",
    })
  }

  if (env.GENERATION_MODE === "llm_only") {
    flags.push({
      key: "GENERATION_MODE",
      effect:
        "llm_only — the model computes the numbers; the neuro-symbolic invariant is off",
    })
  }

  if (isEnabled(env.DEV_PASSWORD_LOGIN)) {
    flags.push({
      key: "DEV_PASSWORD_LOGIN",
      effect: "a password login form is rendered on /login (dev-only tooling)",
    })
  }

  if (!env.ENGINE_BASE_URL) {
    flags.push({
      key: "ENGINE_BASE_URL",
      effect:
        "not set — engine-backed lessons cannot generate and will fail closed",
    })
  }

  return flags
}

/**
 * A multi-line warning naming each active flag, or `null` when the
 * configuration is genuinely engine-backed.
 */
export function demoModeWarning(env: Env): string | null {
  const flags = activeDemoFlags(env)
  if (flags.length === 0) return null

  const lines = flags.map((flag) => `  • ${flag.key} — ${flag.effect}`)
  return [
    "⚠  Jotelab demo mode is active.",
    ...lines,
    "   Worksheet content in this configuration may be NOT engine-generated.",
    "   For an evaluation run see `.env.judge.example`.",
  ].join("\n")
}

/** Thrown when a production build or boot would ship misrepresenting content. */
export class DemoFlagsInProductionError extends Error {
  constructor(flags: readonly DemoFlag[]) {
    super(
      [
        "Refusing to build/boot for production with demo flags enabled:",
        ...flags.map((flag) => `  • ${flag.key} — ${flag.effect}`),
        "These make the app serve content that is not engine-generated.",
        "Unset them, or build for a non-production environment.",
      ].join("\n")
    )
    this.name = "DemoFlagsInProductionError"
  }
}

/**
 * Hard gate for production. A missing `ENGINE_BASE_URL` is deliberately *not*
 * fatal here — that is a deployment gap the engine client already fails closed
 * on, not content misrepresentation.
 */
export function assertNoDemoFlagsInProduction(env: Env): void {
  if (env.NODE_ENV !== "production") return

  const offending = activeDemoFlags(env).filter(
    (flag) => flag.key !== "ENGINE_BASE_URL"
  )
  if (offending.length > 0) {
    throw new DemoFlagsInProductionError(offending)
  }
}

import { demoModeWarning } from "@/lib/demo-mode"

/**
 * `register()` runs once per server instance, before the first request is
 * handled (Next.js `instrumentation.js` file convention).
 *
 * We use it for one thing: printing which demo switches are active. Several
 * settings make the app serve content that is not engine-generated
 * (`SHOWCASE_PRESET`, `E2E_STUB_GENERATION`, `GENERATION_MODE=llm_only`), and
 * they are otherwise invisible — a stubbed worksheet looks exactly like a real
 * one. Logging at boot means whoever starts the server for a demo sees the
 * state, without putting a badge in front of users.
 */
export function register() {
  const warning = demoModeWarning(process.env)
  if (warning) {
    console.warn(`\n${warning}\n`)
  }
}

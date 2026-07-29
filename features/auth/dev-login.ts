"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

import { devPasswordLoginEnabled } from "./dev-login-enabled"

/**
 * Dev-only email/password sign-in for a fully local stack (Docker Supabase,
 * no Google OAuth, no cloud project). Rendered and accepted ONLY when
 * `DEV_PASSWORD_LOGIN=true` — the flag must never be set on a deployed
 * environment; production users exist as OAuth identities with no password,
 * so the action is also useless there by construction.
 *
 * How to test: `npx vitest run features/auth/dev-login.test.ts`, or run
 * `scripts/local-dev-stack.sh` and sign in as the printed test user.
 */

export async function signInWithDevPasswordAction(
  formData: FormData
): Promise<void> {
  if (!devPasswordLoginEnabled()) {
    redirect("/login")
  }

  const email = formData.get("email")
  const password = formData.get("password")

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    redirect("/login?error=dev_credentials")
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect("/login?error=dev_credentials")
  }

  // Mirror /auth/callback: the profile row is created at sign-in time —
  // without it every generation RPC fails with "Profile not found".
  const { error: profileError } = await supabase.rpc("ensure_user_profile")

  if (profileError) {
    await supabase.auth.signOut()
    redirect("/login?error=profile")
  }

  redirect("/generate")
}

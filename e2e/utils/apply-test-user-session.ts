import { createClient } from "@supabase/supabase-js"
import type { Page } from "@playwright/test"

import {
  encodeSupabaseSessionCookie,
  getSupabaseAuthCookieName,
} from "./supabase-auth-cookie"

export async function applyTestUserSession(page: Page, baseURL: string) {
  const email = process.env.E2E_TEST_USER_EMAIL
  const password = process.env.E2E_TEST_USER_PASSWORD
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!email || !password || !supabaseUrl || !anonKey) {
    throw new Error(
      "Authenticated E2E requires E2E_TEST_USER_EMAIL, E2E_TEST_USER_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    )
  }

  if (serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error && !error.message.toLowerCase().includes("already")) {
      throw error
    }
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError || !data.session) {
    throw signInError ?? new Error("Could not sign in E2E test user. Enable Email auth in Supabase.")
  }

  const hostname = new URL(baseURL).hostname

  await page.context().addCookies([
    {
      name: getSupabaseAuthCookieName(supabaseUrl),
      value: encodeSupabaseSessionCookie(data.session),
      // Playwright rejects a cookie carrying both `url` and `domain`/`path`
      // ("Cookie should have either url or domain"), so scope it by
      // domain + path only.
      domain: hostname,
      path: "/",
      httpOnly: false,
      secure: baseURL.startsWith("https"),
      sameSite: "Lax",
    },
  ])
}

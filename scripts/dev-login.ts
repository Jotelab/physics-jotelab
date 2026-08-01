/**
 * Dev-only demo login. Mints a real Supabase session for the demo user and
 * prints the `@supabase/ssr` auth cookie, so a browser can be dropped into an
 * authenticated state without going through the login form.
 *
 * This is deliberately *not* an auth bypass in application code: `proxy.ts` and
 * every RLS policy still see a genuine signed-in user. Nothing here ships — the
 * script refuses to run against a production build, and the demo user only
 * exists in whatever Supabase project `.env.local` points at.
 *
 * Usage:
 *   bun --env-file=.env.local PhysicsJotelab/scripts/dev-login.ts
 */
import { createClient } from "@supabase/supabase-js"

import {
  encodeSupabaseSessionCookie,
  getSupabaseAuthCookieName,
} from "../e2e/utils/supabase-auth-cookie"

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  throw new Error("dev-login is a local development tool and refuses to run in production.")
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.E2E_TEST_USER_EMAIL
const password = process.env.E2E_TEST_USER_PASSWORD

if (!supabaseUrl || !anonKey || !email || !password) {
  throw new Error(
    "dev-login needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD in .env.local."
  )
}

// Same demo account the authenticated Playwright project uses, created the same
// way, so there is one dev identity rather than two drifting ones.
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

const { data, error } = await supabase.auth.signInWithPassword({ email, password })
if (error || !data.session) {
  throw error ?? new Error("Could not sign in the demo user. Enable Email auth in Supabase.")
}

const name = getSupabaseAuthCookieName(supabaseUrl)
const value = encodeSupabaseSessionCookie(data.session)

console.log(JSON.stringify({ name, value, userId: data.session.user.id }, null, 2))
console.log(
  `\nPaste in the browser console on http://localhost:3000, then reload:\n` +
    `document.cookie = ${JSON.stringify(`${name}=${value}; path=/; SameSite=Lax`)}`
)

import type { Session } from "@supabase/supabase-js"

const BASE64_PREFIX = "base64-"

function stringToBase64URL(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

export function getSupabaseAuthCookieName(supabaseUrl: string) {
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0]
  return `sb-${projectRef}-auth-token`
}

/** Cookie value format expected by @supabase/ssr (base64url-encoded JSON session). */
export function encodeSupabaseSessionCookie(session: Session) {
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  })

  return `${BASE64_PREFIX}${stringToBase64URL(payload)}`
}

import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { SignJWT } from "jose"

import { getSupabaseConfig } from "./config"

import { createServiceRoleClient } from "./admin"

async function getAuthUserIdForProfile(profileId: string): Promise<string> {
  const admin = createServiceRoleClient()
  const { data, error } = await admin
    .from("profiles")
    .select("auth_user_id")
    .eq("id", profileId)
    .single()

  if (error || !data?.auth_user_id) {
    throw new Error("Profile not found for background generation")
  }

  return data.auth_user_id
}

async function signUserAccessToken(authUserId: string, issuer: string): Promise<string> {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET

  if (!jwtSecret) {
    throw new Error("SUPABASE_JWT_SECRET is not configured")
  }

  const secret = new TextEncoder().encode(jwtSecret)
  const issuedAt = Math.floor(Date.now() / 1000)

  return new SignJWT({
    role: "authenticated",
    aud: "authenticated",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setSubject(authUserId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 60 * 15)
    .sign(secret)
}

export async function createClientForProfile(profileId: string): Promise<SupabaseClient> {
  const { url, anonKey } = getSupabaseConfig()
  const issuer = `${url.replace(/\/$/, "")}/auth/v1`
  const authUserId = await getAuthUserIdForProfile(profileId)
  const accessToken = await signUserAccessToken(authUserId, issuer)

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

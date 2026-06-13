import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const requestedNext = requestUrl.searchParams.get("next")
  const next =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/generate"

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=callback", request.url))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback", request.url))
  }

  const { error: profileError } = await supabase.rpc("ensure_user_profile")

  if (profileError) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL("/login?error=profile", request.url))
  }

  return NextResponse.redirect(new URL(next, request.url))
}

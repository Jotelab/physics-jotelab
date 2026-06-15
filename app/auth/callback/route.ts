import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const callbackError = requestUrl.searchParams.get("error")
  const callbackErrorDescription = requestUrl.searchParams.get("error_description")
  const code = requestUrl.searchParams.get("code")
  const requestedNext = requestUrl.searchParams.get("next")
  const next =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/generate"

  if (callbackError) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("error", "callback")
    loginUrl.searchParams.set("error_code", callbackError)

    if (callbackErrorDescription) {
      loginUrl.searchParams.set("error_description", callbackErrorDescription)
    }

    return NextResponse.redirect(loginUrl)
  }

  if (!code) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("error", "callback")
    return NextResponse.redirect(loginUrl)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("error", "callback")
    loginUrl.searchParams.set("error_description", error.message)
    return NextResponse.redirect(loginUrl)
  }

  const { error: profileError } = await supabase.rpc("ensure_user_profile")

  if (profileError) {
    await supabase.auth.signOut()
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("error", "profile")
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.redirect(new URL(next, request.url))
}

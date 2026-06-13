"use server"

import { redirect } from "next/navigation"

import { getRequestOrigin } from "@/lib/supabase/get-request-origin"
import { createClient } from "@/lib/supabase/server"

export async function signInWithGoogleAction() {
  const origin = await getRequestOrigin()

  if (!origin) {
    redirect("/login?error=oauth")
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) {
    redirect("/login?error=oauth")
  }

  redirect(data.url)
}

export async function signOutAction() {
  const supabase = await createClient()

  await supabase.auth.signOut()
  redirect("/login")
}

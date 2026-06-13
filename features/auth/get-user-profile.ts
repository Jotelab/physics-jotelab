import "server-only"

import { cache } from "react"

import type { UserProfile } from "@/features/auth/types"
import { createClient } from "@/lib/supabase/server"

export type { UserProfile } from "@/features/auth/types"

export const getUserProfile = cache(async function getUserProfile() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("ensure_user_profile")

  if (error) {
    throw new Error("Could not load user profile")
  }

  return data as UserProfile
})

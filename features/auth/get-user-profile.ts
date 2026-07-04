import "server-only"

import { cache } from "react"

import { userProfileSchema } from "@/features/auth/schemas"
import { createClient } from "@/lib/supabase/server"

export type { UserProfile } from "@/features/auth/types"

export const getUserProfile = cache(async function getUserProfile() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("ensure_user_profile")

  if (error) {
    throw new Error("Could not load user profile")
  }

  const profile = userProfileSchema.safeParse(data)

  if (!profile.success) {
    throw new Error("Could not load user profile")
  }

  return profile.data
})

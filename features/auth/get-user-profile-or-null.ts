import "server-only"

import { getUserProfile } from "./get-user-profile"
import type { UserProfile } from "./types"

/**
 * The signed-in user's profile, or `null` when there isn't one.
 *
 * {@link getUserProfile} throws for anonymous visitors and when Supabase is
 * unreachable — correct for the dashboard, which is behind an auth gate. `/learn`
 * is deliberately not behind that gate (a coached solve needs no account and no
 * Supabase, only the engine), but it still renders the app shell, and the shell
 * accepts a null profile. This is the adapter between those two facts: signed-in
 * students get their usual chrome, everyone else gets the same chrome without
 * profile details, and nobody gets an error page.
 */
export async function getUserProfileOrNull(): Promise<UserProfile | null> {
  try {
    return await getUserProfile()
  } catch {
    return null
  }
}

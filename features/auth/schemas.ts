import { z } from "zod"

/**
 * Runtime contract for the profile the `ensure_user_profile` RPC returns.
 *
 * The RPC returns the whole `profiles` row; only these four fields are part of
 * the app-facing `UserProfile`, and `z.object` strips the rest — so a validated
 * profile carries nothing more than it declares (no `auth_user_id`, timestamps,
 * etc. leak into the server→client payload). `UserProfile` is derived from this
 * schema so the type and the runtime check can never drift.
 */
export const userProfileSchema = z.object({
  display_name: z.string().nullable(),
  email: z.string(),
  avatar_url: z.string().nullable(),
  credit_balance: z.number(),
})

export type UserProfile = z.infer<typeof userProfileSchema>

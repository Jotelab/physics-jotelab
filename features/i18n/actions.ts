"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

import { localeCookieName, locales, type Locale } from "@/i18n/config"

export async function setLocaleAction(locale: Locale) {
  if (!locales.includes(locale)) {
    return
  }

  const cookieStore = await cookies()
  cookieStore.set(localeCookieName, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath("/", "layout")
}

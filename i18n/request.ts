import { getRequestConfig } from "next-intl/server"
import { cookies, headers } from "next/headers"

import { defaultLocale, localeCookieName, locales, type Locale } from "./config"

function resolveLocale(raw: string | undefined): Locale | null {
  if (raw && locales.includes(raw as Locale)) {
    return raw as Locale
  }

  return null
}

function localeFromAcceptLanguage(headerValue: string | null): Locale | null {
  if (!headerValue) {
    return null
  }

  const preferred = headerValue
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase())
    .filter(Boolean)

  for (const language of preferred) {
    if (language === "th" || language?.startsWith("th-")) {
      return "th"
    }

    if (language === "en" || language?.startsWith("en-")) {
      return "en"
    }
  }

  return null
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieLocale = resolveLocale(cookieStore.get(localeCookieName)?.value)

  if (cookieLocale) {
    return {
      locale: cookieLocale,
      messages: (await import(`../messages/${cookieLocale}.json`)).default,
    }
  }

  const headerStore = await headers()
  const locale = localeFromAcceptLanguage(headerStore.get("accept-language")) ?? defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})

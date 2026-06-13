import { defineRouting } from "next-intl/routing"

import { defaultLocale, localeCookieName, locales } from "./config"

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "never",
  localeCookie: {
    name: localeCookieName,
  },
})

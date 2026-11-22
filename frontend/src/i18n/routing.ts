/**
 * @file Locales of the site.
 * @description The default locale has no URL prefix ("/login"), the others have one ("/ru/login"), so the links in
 * the backend emails ("/reset-password?token=...") work without a locale.
 */

import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["en", "ru"],
  defaultLocale: "en",
  localePrefix: "as-needed",
})

export type Locale = (typeof routing.locales)[number]

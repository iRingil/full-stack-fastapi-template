/**
 * @file Per-request i18n configuration: resolves the locale and loads its messages.
 */

import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { type Locale, routing } from "./routing"

export default getRequestConfig(async ({ requestLocale }) => {
  const requested: string | undefined = await requestLocale
  const locale: Locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default }
})

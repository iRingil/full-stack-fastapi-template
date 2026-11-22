/**
 * @file Per-request i18n configuration: resolves the locale and loads its messages.
 * @description The locale is the `[locale]` root param (`next/root-params`), readable while pages are rendered
 * statically. An explicit locale passed to a next-intl function (`getTranslations({ locale })`) wins.
 */

import { notFound } from "next/navigation"
import * as rootParams from "next/root-params"
import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { routing } from "./routing"

export default getRequestConfig(async ({ locale: explicit }) => {
  const requested: string | undefined = explicit ?? (await rootParams.locale())
  // The `[locale]` segment also catches unknown first path segments such as `/unknown.txt`
  if (!hasLocale(routing.locales, requested)) {
    notFound()
  }
  return { locale: requested, messages: (await import(`../../messages/${requested}.json`)).default }
})

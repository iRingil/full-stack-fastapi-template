/**
 * @file Site-wide values for metadata.
 */

import type { Metadata } from "next"
import { hasLocale } from "next-intl"
import { getPathname } from "@/i18n/navigation"
import { type Locale, routing } from "@/i18n/routing"

/**
 * The public URL of the site (`SITE_URL`), the base of canonical and Open Graph links.
 * @returns The URL; http://localhost:5173 when the variable is not set.
 */
export function siteUrl(): URL {
  return new URL(process.env.SITE_URL ?? "http://localhost:5173")
}

/** Route params of every page and layout under `app/[locale]`. */
export type LocaleParams = { params: Promise<{ locale: string }> }

/**
 * Reads the locale from the route params (the root layout has already rejected unknown ones with a 404).
 * @param params - The route params.
 * @returns The locale, the default one for an unknown value.
 */
export async function localeOf(params: LocaleParams["params"]): Promise<Locale> {
  const { locale } = await params
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale
}

/**
 * Canonical and alternate-language links of a public page.
 * @param href - The page path without the locale, e.g. "/login".
 * @param locale - The current locale.
 * @returns The `alternates` metadata.
 */
export function localeAlternates(href: string, locale: Locale): Metadata["alternates"] {
  return {
    canonical: getPathname({ href, locale }),
    languages: Object.fromEntries(
      routing.locales.map((other: Locale): [string, string] => [other, getPathname({ href, locale: other })]),
    ),
  }
}

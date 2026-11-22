/**
 * @file Site-wide values for metadata.
 */

import type { Metadata } from "next"
import { getPathname } from "@/i18n/navigation"
import { type Locale, routing } from "@/i18n/routing"

/**
 * The public URL of the site (`SITE_URL`), the base of canonical and Open Graph links.
 * @returns The URL; http://localhost:5173 when the variable is not set.
 */
export function siteUrl(): URL {
  return new URL(process.env.SITE_URL ?? "http://localhost:5173")
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

/**
 * @file `/sitemap.xml`: the public pages in every locale.
 */

import type { MetadataRoute } from "next"
import { getPathname } from "@/i18n/navigation"
import { type Locale, routing } from "@/i18n/routing"
import { siteUrl } from "@/lib/site"

/** Public pages worth indexing; add the site's own pages here. */
const PUBLIC_PAGES: readonly string[] = ["/", "/login", "/signup", "/recover-password"]

export default function sitemap(): MetadataRoute.Sitemap {
  const base: URL = siteUrl()
  const url = (href: string, locale: Locale): string => new URL(getPathname({ href, locale }), base).toString()
  return PUBLIC_PAGES.map((href: string): MetadataRoute.Sitemap[number] => ({
    url: url(href, routing.defaultLocale),
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale: Locale): [string, string] => [locale, url(href, locale)]),
      ),
    },
  }))
}

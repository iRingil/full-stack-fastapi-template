/**
 * @file `/robots.txt`: the logged-in area and the API are not for crawlers.
 */

import type { MetadataRoute } from "next"
import { routing } from "@/i18n/routing"
import { PROTECTED_PATHS } from "@/lib/paths"
import { siteUrl } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  const localized: string[] = routing.locales.flatMap((locale): string[] =>
    PROTECTED_PATHS.map((path: string): string => `/${locale}${path}`),
  )
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", ...PROTECTED_PATHS, ...localized] },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  }
}

/**
 * @file Root layout of every localized page: `<html lang>`, site metadata and the client providers.
 * @description It is the app's root layout (there is no `app/layout.tsx`), so `[locale]` is a root param: next-intl
 * reads it through `next/root-params` (see `i18n/request.ts`) and the pages need no `setRequestLocale`.
 */

import type { Metadata, Viewport } from "next"
import { Onest } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { Providers } from "@/components/Providers"
import { type Locale, routing } from "@/i18n/routing"
import { siteUrl } from "@/lib/site"
import "@/styles/globals.css"

/** The site's typeface: a variable font with Cyrillic, self-hosted by Next.js (no requests to Google at runtime). */
const onest = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-onest", display: "swap" })

/** Pre-renders the static pages for every locale. */
export function generateStaticParams(): { locale: string }[] {
  return routing.locales.map((locale: string): { locale: string } => ({ locale }))
}

export async function generateMetadata(): Promise<Metadata> {
  const locale: Locale = await getLocale()
  const t = await getTranslations("Metadata")
  return {
    metadataBase: siteUrl(),
    title: { default: t("siteName"), template: `%s | ${t("siteName")}` },
    description: t("description"),
    applicationName: t("siteName"),
    icons: { icon: "/assets/images/favicon.png" },
    openGraph: { type: "website", siteName: t("siteName"), locale },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f5" },
    { media: "(prefers-color-scheme: dark)", color: "#060607" },
  ],
}

export default async function LocaleLayout({ children }: { children: ReactNode }): Promise<ReactNode> {
  // An unknown locale has already been answered with a 404 by i18n/request.ts
  const locale: Locale = await getLocale()

  return (
    // next-themes sets the theme class on <html> before hydration
    <html lang={locale} className={onest.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

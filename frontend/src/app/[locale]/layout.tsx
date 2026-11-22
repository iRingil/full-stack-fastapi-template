/**
 * @file Root layout of every localized page: `<html lang>`, site metadata and the client providers.
 */

import type { Metadata, Viewport } from "next"
import { notFound } from "next/navigation"
import { hasLocale, NextIntlClientProvider } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { ReactNode } from "react"
import { Providers } from "@/components/Providers"
import { type Locale, routing } from "@/i18n/routing"
import { type LocaleParams, localeOf, siteUrl } from "@/lib/site"
import "@/styles/globals.css"

/** Pre-renders the static pages for every locale. */
export function generateStaticParams(): { locale: string }[] {
  return routing.locales.map((locale: string): { locale: string } => ({ locale }))
}

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale: Locale = await localeOf(params)
  const t = await getTranslations({ locale, namespace: "Metadata" })
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
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleParams & { children: ReactNode }): Promise<ReactNode> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)

  return (
    // next-themes sets the theme class on <html> before hydration
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

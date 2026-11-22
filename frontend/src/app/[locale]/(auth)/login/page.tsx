/**
 * @file The login page.
 * The form reads the query string, known only in the browser for a static page, hence the Suspense.
 */

import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { type ReactNode, Suspense } from "react"
import { LoginForm } from "@/components/Auth/LoginForm"
import type { Locale } from "@/i18n/routing"
import { type LocaleParams, localeAlternates, localeOf } from "@/lib/site"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale: Locale = await localeOf(params)
  const t = await getTranslations({ locale, namespace: "Login" })
  return { title: t("title"), alternates: localeAlternates("/login", locale) }
}

export default async function LoginPage({ params }: LocaleParams): Promise<ReactNode> {
  setRequestLocale(await localeOf(params))
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

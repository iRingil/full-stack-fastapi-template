/**
 * @file The "forgot password" page.
 */

import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { ReactNode } from "react"
import { RecoverPasswordForm } from "@/components/Auth/RecoverPasswordForm"
import type { Locale } from "@/i18n/routing"
import { type LocaleParams, localeAlternates, localeOf } from "@/lib/site"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale: Locale = await localeOf(params)
  const t = await getTranslations({ locale, namespace: "RecoverPassword" })
  return { title: t("title"), alternates: localeAlternates("/recover-password", locale) }
}

export default async function RecoverPasswordPage({ params }: LocaleParams): Promise<ReactNode> {
  setRequestLocale(await localeOf(params))
  return <RecoverPasswordForm />
}

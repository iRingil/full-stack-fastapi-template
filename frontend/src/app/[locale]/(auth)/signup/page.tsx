/**
 * @file The sign-up page.
 */

import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { ReactNode } from "react"
import { SignUpForm } from "@/components/Auth/SignUpForm"
import type { Locale } from "@/i18n/routing"
import { type LocaleParams, localeAlternates, localeOf } from "@/lib/site"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale: Locale = await localeOf(params)
  const t = await getTranslations({ locale, namespace: "SignUp" })
  return { title: t("title"), alternates: localeAlternates("/signup", locale) }
}

export default async function SignUpPage({ params }: LocaleParams): Promise<ReactNode> {
  setRequestLocale(await localeOf(params))
  return <SignUpForm />
}

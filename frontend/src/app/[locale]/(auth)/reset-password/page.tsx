/**
 * @file The page of the emailed password reset link.
 * The form reads the query string, known only in the browser for a static page, hence the Suspense.
 */

import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { type ReactNode, Suspense } from "react"
import { ResetPasswordForm } from "@/components/Auth/ResetPasswordForm"
import type { Locale } from "@/i18n/routing"
import { type LocaleParams, localeOf } from "@/lib/site"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale: Locale = await localeOf(params)
  const t = await getTranslations({ locale, namespace: "ResetPassword" })
  return { title: t("title"), robots: { index: false } }
}

export default async function ResetPasswordPage({ params }: LocaleParams): Promise<ReactNode> {
  setRequestLocale(await localeOf(params))
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}

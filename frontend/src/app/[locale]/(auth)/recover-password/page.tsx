/**
 * @file The "forgot password" page.
 */

import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { RecoverPasswordForm } from "@/components/Auth/RecoverPasswordForm"
import { localeAlternates } from "@/lib/site"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("RecoverPassword")
  return { title: t("title"), alternates: localeAlternates("/recover-password", await getLocale()) }
}

export default function RecoverPasswordPage(): ReactNode {
  return <RecoverPasswordForm />
}

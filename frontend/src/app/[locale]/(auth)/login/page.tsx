/**
 * @file The login page.
 * The form reads the query string, known only in the browser for a static page, hence the Suspense.
 */

import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { type ReactNode, Suspense } from "react"
import { LoginForm } from "@/components/Auth/LoginForm"
import { localeAlternates } from "@/lib/site"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Login")
  return { title: t("title"), alternates: localeAlternates("/login", await getLocale()) }
}

export default function LoginPage(): ReactNode {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

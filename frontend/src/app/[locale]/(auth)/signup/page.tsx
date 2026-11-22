/**
 * @file The sign-up page.
 */

import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { SignUpForm } from "@/components/Auth/SignUpForm"
import { localeAlternates } from "@/lib/site"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("SignUp")
  return { title: t("title"), alternates: localeAlternates("/signup", await getLocale()) }
}

export default function SignUpPage(): ReactNode {
  return <SignUpForm />
}

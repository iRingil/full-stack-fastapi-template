/**
 * @file The page of the emailed password reset link.
 * The form reads the query string, known only in the browser for a static page, hence the Suspense.
 */

import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { type ReactNode, Suspense } from "react"
import { ResetPasswordForm } from "@/components/Auth/ResetPasswordForm"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ResetPassword")
  return { title: t("title"), robots: { index: false } }
}

export default function ResetPasswordPage(): ReactNode {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}

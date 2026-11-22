/**
 * @file The page of the emailed address confirmation link.
 * The form reads the query string, known only in the browser for a static page, hence the Suspense.
 */

import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { type ReactNode, Suspense } from "react"
import { VerifyEmail } from "@/components/Auth/VerifyEmail"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("VerifyEmail")
  return { title: t("title"), robots: { index: false } }
}

export default function VerifyEmailPage(): ReactNode {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  )
}

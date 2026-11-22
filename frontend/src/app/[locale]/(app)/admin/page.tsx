/**
 * @file The user administration page.
 * The form reads the query string, known only in the browser for a static page, hence the Suspense.
 */

import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { type ReactNode, Suspense } from "react"
import { UsersView } from "@/components/Admin/UsersView"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin")
  return { title: t("title") }
}

export default function UsersPage(): ReactNode {
  return (
    <Suspense>
      <UsersView />
    </Suspense>
  )
}

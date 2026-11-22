/**
 * @file The items page.
 * The form reads the query string, known only in the browser for a static page, hence the Suspense.
 */

import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { type ReactNode, Suspense } from "react"
import { ItemsView } from "@/components/Items/ItemsView"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Items")
  return { title: t("title") }
}

export default function ItemsPage(): ReactNode {
  return (
    <Suspense>
      <ItemsView />
    </Suspense>
  )
}

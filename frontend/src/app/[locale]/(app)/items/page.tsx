/**
 * @file The items page.
 * The form reads the query string, known only in the browser for a static page, hence the Suspense.
 */

import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { type ReactNode, Suspense } from "react"
import { ItemsView } from "@/components/Items/ItemsView"
import type { Locale } from "@/i18n/routing"
import { type LocaleParams, localeOf } from "@/lib/site"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale: Locale = await localeOf(params)
  const t = await getTranslations({ locale, namespace: "Items" })
  return { title: t("title") }
}

export default async function ItemsPage({ params }: LocaleParams): Promise<ReactNode> {
  setRequestLocale(await localeOf(params))
  return (
    <Suspense>
      <ItemsView />
    </Suspense>
  )
}

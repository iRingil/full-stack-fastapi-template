/**
 * @file The dashboard.
 */

import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { ReactNode } from "react"
import { DashboardView } from "@/components/Dashboard/DashboardView"
import type { Locale } from "@/i18n/routing"
import { type LocaleParams, localeOf } from "@/lib/site"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale: Locale = await localeOf(params)
  const t = await getTranslations({ locale, namespace: "Dashboard" })
  return { title: t("title") }
}

export default async function DashboardPage({ params }: LocaleParams): Promise<ReactNode> {
  setRequestLocale(await localeOf(params))
  return <DashboardView />
}

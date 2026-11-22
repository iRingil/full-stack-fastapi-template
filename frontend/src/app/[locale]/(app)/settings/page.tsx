/**
 * @file The user settings page.
 */

import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { ReactNode } from "react"
import { SettingsView } from "@/components/UserSettings/SettingsView"
import type { Locale } from "@/i18n/routing"
import { type LocaleParams, localeOf } from "@/lib/site"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale: Locale = await localeOf(params)
  const t = await getTranslations({ locale, namespace: "Settings" })
  return { title: t("title") }
}

export default async function SettingsPage({ params }: LocaleParams): Promise<ReactNode> {
  setRequestLocale(await localeOf(params))
  return <SettingsView />
}

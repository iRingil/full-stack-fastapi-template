/**
 * @file The user settings page.
 */

import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { SettingsView } from "@/components/UserSettings/SettingsView"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings")
  return { title: t("title") }
}

export default function SettingsPage(): ReactNode {
  return <SettingsView />
}

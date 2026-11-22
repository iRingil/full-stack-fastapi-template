/**
 * @file The dashboard.
 */

import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { DashboardView } from "@/components/Dashboard/DashboardView"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard")
  return { title: t("title") }
}

export default function DashboardPage(): ReactNode {
  return <DashboardView />
}

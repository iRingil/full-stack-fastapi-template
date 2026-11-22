/**
 * @file The 404 page content.
 */

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { LinkButton } from "@/components/ui/LinkButton"

/**
 * Renders the 404 message with a link home.
 * @returns The page content.
 */
export function NotFound(): ReactNode {
  const t = useTranslations("NotFound")
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-7xl font-bold text-accent">404</p>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted">{t("description")}</p>
      <LinkButton href="/" variant="secondary" className="mt-2">
        {t("goHome")}
      </LinkButton>
    </main>
  )
}

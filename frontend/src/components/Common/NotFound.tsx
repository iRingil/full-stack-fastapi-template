/**
 * @file The 404 page content.
 */

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { LinkButton } from "@/components/ui/LinkButton"

/**
 * Renders the 404 message with a link home.
 * @description The page title is set here (React hoists `<title>` into the head): a 404 has no page metadata.
 * @returns The page content.
 */
export function NotFound(): ReactNode {
  const t = useTranslations("NotFound")
  const tm = useTranslations("Metadata")
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-4 text-center">
      <title>{`${t("title")} | ${tm("siteName")}`}</title>
      <p className="text-7xl font-bold text-accent">404</p>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted">{t("description")}</p>
      <LinkButton href="/" variant="secondary" className="mt-2">
        {t("goHome")}
      </LinkButton>
    </main>
  )
}

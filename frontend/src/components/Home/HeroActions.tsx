/**
 * @file The buttons of the home page's hero: the dashboard, and the sign-up for a guest.
 * @description The page is static: "Create an account" appears once the browser knows the visitor is not logged
 * in, so a logged-in user is never offered it.
 */

"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { LinkButton } from "@/components/ui/LinkButton"
import { useSession } from "@/hooks/useAuth"
import { DASHBOARD_PATH } from "@/lib/paths"

/**
 * Renders the buttons.
 * @returns The dashboard button, and the sign-up one for a guest.
 */
export function HeroActions(): ReactNode {
  const t = useTranslations("Home")
  const { data: isLoggedIn } = useSession()
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <LinkButton href={DASHBOARD_PATH} size="lg">
        {t("openDashboard")}
      </LinkButton>
      {isLoggedIn === false ? (
        <LinkButton href="/signup" size="lg" variant="outline">
          {t("createAccount")}
        </LinkButton>
      ) : null}
    </div>
  )
}

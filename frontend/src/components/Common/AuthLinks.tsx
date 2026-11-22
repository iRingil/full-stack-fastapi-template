/**
 * @file The account links of the public header: "Log in" and "Sign up" for a guest, the dashboard for a user.
 * @description The page is static, so the links appear once the browser knows whether the visitor is logged in;
 * until then there are none, as in the server-rendered HTML.
 */

"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { LinkButton } from "@/components/ui/LinkButton"
import { useSession } from "@/hooks/useAuth"
import { DASHBOARD_PATH, LOGIN_PATH } from "@/lib/paths"

/**
 * Renders the links for the visitor.
 * @returns The links, or nothing while unknown.
 */
export function AuthLinks(): ReactNode {
  const t = useTranslations("Nav")
  const { data: isLoggedIn } = useSession()
  if (isLoggedIn === undefined) {
    return null
  }
  if (isLoggedIn) {
    return (
      <LinkButton href={DASHBOARD_PATH} size="sm">
        {t("toApp")}
      </LinkButton>
    )
  }
  return (
    <>
      <LinkButton href={LOGIN_PATH} variant="ghost" size="sm">
        {t("login")}
      </LinkButton>
      <LinkButton href="/signup" size="sm">
        {t("signUp")}
      </LinkButton>
    </>
  )
}

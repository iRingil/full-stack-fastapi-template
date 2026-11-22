/**
 * @file Header of the public pages (home, login, sign-up, ...): logo, language, theme and the login links.
 * @description The auth cookie is httpOnly, so the header cannot tell whether the visitor is logged in; for a
 * logged-in user `proxy.ts` turns "Log in" into a redirect to the dashboard.
 */

import { useTranslations } from "next-intl"
import { type ReactNode, Suspense } from "react"
import { LinkButton } from "@/components/ui/LinkButton"
import { LocaleSwitch } from "./LocaleSwitch"
import { Logo } from "./Logo"
import { ThemeSwitch } from "./ThemeSwitch"

/**
 * Renders the header.
 * @param props - Whether to show the login and sign-up links (hidden on the auth pages themselves).
 * @returns The header.
 */
export function PublicHeader({ showAuthLinks = true }: { showAuthLinks?: boolean }): ReactNode {
  const t = useTranslations("Nav")
  return (
    <header className="border-b border-separator">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Logo />
        <div className="ms-auto flex items-center gap-1">
          {/* The switch reads the query string, which is known only in the browser for static pages */}
          <Suspense>
            <LocaleSwitch />
          </Suspense>
          <ThemeSwitch />
          {showAuthLinks ? (
            <>
              <LinkButton href="/login" variant="ghost" size="sm">
                {t("login")}
              </LinkButton>
              <LinkButton href="/signup" size="sm">
                {t("signUp")}
              </LinkButton>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}

/**
 * @file Header of the public pages (home, login, sign-up, ...): logo, language, theme and the account links.
 * @description The account links depend on whether the visitor is logged in, which only the browser learns (see
 * `AuthLinks`).
 */

import { type ReactNode, Suspense } from "react"
import { AuthLinks } from "./AuthLinks"
import { LocaleSwitch } from "./LocaleSwitch"
import { Logo } from "./Logo"
import { ThemeSwitch } from "./ThemeSwitch"

/**
 * Renders the header.
 * @param props - Whether to show the account links (hidden on the auth pages themselves).
 * @returns The header.
 */
export function PublicHeader({ showAuthLinks = true }: { showAuthLinks?: boolean }): ReactNode {
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
          {showAuthLinks ? <AuthLinks /> : null}
        </div>
      </div>
    </header>
  )
}

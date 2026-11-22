/**
 * @file All client-side providers of the app, assembled once for the root layout.
 * @description Theme (next-themes writes both the class and `data-theme` that HeroUI reads), the React Aria router
 * (HeroUI links and menu items navigate through next-intl), TanStack Query and the toast region. A 401 from any
 * request ends the session: the cookie is cleared and the user is sent to the login page.
 */

"use client"

import { I18nProvider, RouterProvider, Toast } from "@heroui/react"
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useLocale } from "next-intl"
import { ThemeProvider } from "next-themes"
import { type ReactNode, useRef, useState } from "react"
import { getPathname, useRouter } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { installApiErrors } from "@/lib/api-error"
import { requestLogout } from "@/lib/auth-client"
import { LOGIN_PATH } from "@/lib/paths"
import { createQueryClient } from "@/lib/query-client"

installApiErrors()

// next-themes renders an inline script that sets the theme before the first paint. It must run in the server HTML;
// when the root layout renders again on the client (a switch of language changes the [locale] root param), the
// same script would make React warn about a script tag it never executes, so there it is a data block instead.
const THEME_SCRIPT_PROPS = { type: typeof window === "undefined" ? "text/javascript" : "text/plain" }

/**
 * Wraps the app in its providers.
 * @param props - The app.
 * @returns The wrapped app.
 */
export function Providers({ children }: { children: ReactNode }): ReactNode {
  const router = useRouter()
  const locale: Locale = useLocale()
  const isLoggingOut = useRef<boolean>(false)

  // One logout per session end: after it, the still mounted queries refetch and get 401 again until the page
  // changes; the guard lifts only when a query succeeds, i.e. after the next login
  const [queryClient] = useState<QueryClient>(() =>
    createQueryClient(
      (): void => {
        if (isLoggingOut.current) {
          return
        }
        isLoggingOut.current = true
        void requestLogout().then((): void => {
          queryClient.clear()
          router.replace(LOGIN_PATH)
        })
      },
      (): void => {
        isLoggingOut.current = false
      },
    ),
  )

  return (
    <ThemeProvider
      attribute={["class", "data-theme"]}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={THEME_SCRIPT_PROPS}
    >
      {/* The built-in texts of the components (React Aria) follow the site's language, not the browser's */}
      <I18nProvider locale={locale}>
        <RouterProvider
          navigate={(href: string): void => router.push(href)}
          useHref={(href: string): string => (href.startsWith("/") ? getPathname({ href, locale }) : href)}
        >
          <QueryClientProvider client={queryClient}>
            {children}
            <Toast.Provider placement="bottom end" />
            <ReactQueryDevtools buttonPosition="bottom-left" />
          </QueryClientProvider>
        </RouterProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}

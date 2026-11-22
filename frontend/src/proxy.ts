/**
 * @file Next.js proxy (runs before every page request): page access by the auth cookie, then next-intl routing.
 * @description Only the presence of the cookie is checked here; an expired or revoked token is caught by the
 * backend's 401, after which the client logs out (see `components/Providers.tsx`).
 */

import { type NextRequest, NextResponse } from "next/server"
import createMiddleware from "next-intl/middleware"
import { routing } from "@/i18n/routing"
import { DASHBOARD_PATH, GUEST_ONLY_PATHS, LOGIN_PATH, matchesPath, PROTECTED_PATHS } from "@/lib/paths"
import { AUTH_COOKIE } from "@/lib/server/backend"

const handleI18n = createMiddleware(routing)

/**
 * Splits the locale prefix off a path.
 * @param pathname - The request path, e.g. "/ru/items".
 * @returns The prefix ("/ru", or "" without one) and the rest ("/items").
 */
export function splitLocale(pathname: string): { prefix: string; path: string } {
  for (const locale of routing.locales) {
    const prefix = `/${locale}`
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return { prefix, path: pathname.slice(prefix.length) || "/" }
    }
  }
  return { prefix: "", path: pathname }
}

/**
 * Redirects by access rules, otherwise hands over to next-intl.
 * @param request - The page request.
 * @returns A redirect or the next-intl response.
 */
export default function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl
  const { prefix, path } = splitLocale(pathname)
  const isLoggedIn: boolean = request.cookies.has(AUTH_COOKIE)

  if (!isLoggedIn && matchesPath(path, PROTECTED_PATHS)) {
    const url: URL = new URL(`${prefix}${LOGIN_PATH}`, request.url)
    url.searchParams.set("from", `${path}${search}`)
    return NextResponse.redirect(url)
  }
  if (isLoggedIn && matchesPath(path, GUEST_ONLY_PATHS)) {
    return NextResponse.redirect(new URL(`${prefix}${DASHBOARD_PATH}`, request.url))
  }
  return handleI18n(request)
}

export const config = {
  // Everything except API routes, Next.js internals and files with an extension (favicon.ico, images)
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
}

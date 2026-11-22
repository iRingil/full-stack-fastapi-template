/**
 * @file Site paths (without the locale prefix) and the access rules that `proxy.ts` enforces.
 */

export const HOME_PATH = "/"
export const LOGIN_PATH = "/login"
export const DASHBOARD_PATH = "/dashboard"

/** Pages for logged-in users only: an anonymous visitor is sent to the login page. */
export const PROTECTED_PATHS: readonly string[] = [DASHBOARD_PATH, "/items", "/admin", "/settings"]

/** Pages for anonymous visitors only: a logged-in user is sent to the dashboard. */
export const GUEST_ONLY_PATHS: readonly string[] = [LOGIN_PATH, "/signup"]

/**
 * Checks whether a path is one of the given pages or below one of them.
 * @param path - A path without the locale prefix, e.g. "/items".
 * @param pages - The pages to match.
 * @returns True for "/items" and "/items/x" against "/items", false for "/itemsx".
 */
export function matchesPath(path: string, pages: readonly string[]): boolean {
  return pages.some((page: string): boolean => path === page || path.startsWith(`${page}/`))
}

/**
 * Validates the `from` parameter of the login page, so that it cannot redirect to another site.
 * @param from - The raw parameter value.
 * @returns The path when it is local ("/items?page=2"), otherwise the dashboard.
 */
export function safeRedirectPath(from: string | null | undefined): string {
  if (!from?.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) {
    return DASHBOARD_PATH
  }
  return from
}

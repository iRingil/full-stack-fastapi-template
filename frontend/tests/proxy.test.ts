// @vitest-environment node

import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import proxy, { splitLocale } from "@/proxy"

/**
 * Runs the proxy for a page request.
 * @param path - The path with the query.
 * @param loggedIn - Whether the auth cookie is present.
 * @returns The redirect target, or null when the request passes.
 */
function redirectOf(path: string, loggedIn: boolean): string | null {
  const headers: Record<string, string> = loggedIn ? { cookie: "access_token=tok" } : {}
  const response = proxy(new NextRequest(`http://site${path}`, { headers }))
  return response.status >= 300 && response.status < 400 ? response.headers.get("location") : null
}

describe("splitLocale", () => {
  it("splits the locale prefix off", () => {
    expect(splitLocale("/ru/items")).toEqual({ prefix: "/ru", path: "/items" })
    expect(splitLocale("/ru")).toEqual({ prefix: "/ru", path: "/" })
    expect(splitLocale("/items")).toEqual({ prefix: "", path: "/items" })
    expect(splitLocale("/russia")).toEqual({ prefix: "", path: "/russia" })
  })
})

describe("proxy", () => {
  it("sends an anonymous visitor of a protected page to login, remembering the page", () => {
    expect(redirectOf("/items?page=2", false)).toBe("http://site/login?from=%2Fitems%3Fpage%3D2")
    expect(redirectOf("/ru/admin", false)).toBe("http://site/ru/login?from=%2Fadmin")
  })

  it("sends a logged-in user away from login and sign-up", () => {
    expect(redirectOf("/login", true)).toBe("http://site/dashboard")
    expect(redirectOf("/ru/signup", true)).toBe("http://site/ru/dashboard")
  })

  it("lets allowed requests through to next-intl", () => {
    expect(redirectOf("/items", true)).toBeNull()
    expect(redirectOf("/login", false)).toBeNull()
    expect(redirectOf("/reset-password?token=x", true)).toBeNull()
  })
})

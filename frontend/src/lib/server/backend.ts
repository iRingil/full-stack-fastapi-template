/**
 * @file Server-side helpers for talking to the backend (route handlers only, never the browser).
 * @description The browser never sees the access token: the login route stores it in an httpOnly cookie, and the
 * API proxy turns the cookie back into an `Authorization` header.
 */

import type { NextRequest } from "next/server"

/** Whether this is a production build: the auth cookie is then `Secure` and bound to this host. */
export const IS_PRODUCTION: boolean = process.env.NODE_ENV === "production"

/**
 * Name of the httpOnly cookie that holds the backend's access token.
 * In production it has the `__Host-` prefix: the browser then accepts it only with `Secure`, `Path=/` and no
 * `Domain`, so neither a subdomain nor a plain-HTTP page can set or overwrite it. Development runs over plain HTTP,
 * where browsers reject the prefix.
 */
export const AUTH_COOKIE: string = IS_PRODUCTION ? "__Host-access_token" : "access_token"

/**
 * Request headers passed through to the backend; the client IP is needed by its rate limiters.
 * `X-Forwarded-For` is trusted as it arrives: the reverse proxy in front of this server must overwrite it with the
 * real peer address (`infrastructure/nginx`), and this server must not be reachable past the proxy.
 */
const FORWARDED_REQUEST_HEADERS: readonly string[] = [
  "accept",
  "accept-language",
  "content-type",
  "user-agent",
  "x-forwarded-for",
  "x-real-ip",
]

/**
 * Builds a backend URL from the server-only `API_URL` variable.
 * @param pathAndQuery - The path with the query string, e.g. "/api/v1/items/?skip=0".
 * @returns The absolute URL.
 * @throws {Error} If `API_URL` is not set.
 */
export function backendUrl(pathAndQuery: string): URL {
  const apiUrl: string | undefined = process.env.API_URL
  if (!apiUrl) {
    throw new Error("API_URL is not set")
  }
  return new URL(pathAndQuery, apiUrl)
}

/**
 * Copies the allowed request headers and adds the bearer token from the auth cookie.
 * @param request - The incoming request.
 * @returns The headers for the backend request.
 */
export function backendHeaders(request: NextRequest): Headers {
  const headers: Headers = new Headers()
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value: string | null = request.headers.get(name)
    if (value !== null) {
      headers.set(name, value)
    }
  }
  const token: string | undefined = request.cookies.get(AUTH_COOKIE)?.value
  if (token) {
    headers.set("authorization", `Bearer ${token}`)
  }
  return headers
}

/**
 * Rejects cross-site requests that change state (CSRF): browsers always send `Origin` with such requests.
 * @param request - The incoming request.
 * @returns True when there is no `Origin` header or it matches the host the request was sent to.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin: string | null = request.headers.get("origin")
  if (origin === null) {
    return true
  }
  const host: string | null = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * Computes the cookie lifetime from the token's `exp` claim, so that the cookie expires with the token.
 * @param token - A JWT.
 * @param now - The current time in milliseconds.
 * @returns Seconds until expiry, or undefined (a session cookie) when the token carries no readable `exp`.
 */
export function tokenMaxAge(token: string, now: number = Date.now()): number | undefined {
  const payload: string | undefined = token.split(".")[1]
  if (!payload) {
    return undefined
  }
  try {
    const { exp }: { exp?: unknown } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    return typeof exp === "number" ? Math.max(0, Math.floor(exp - now / 1000)) : undefined
  } catch {
    return undefined
  }
}

/**
 * Builds a JSON error response in FastAPI's shape, so the client handles it like a backend error.
 * @param status - The HTTP status.
 * @param detail - The message.
 * @returns The response.
 */
export function errorResponse(status: number, detail: string): Response {
  return Response.json({ detail }, { status })
}

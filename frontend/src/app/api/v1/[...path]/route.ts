/**
 * @file Proxy of the backend API: `/api/v1/*` on this site is forwarded to `${API_URL}/api/v1/*`.
 * @description The browser calls the same origin (no CORS), the access token travels in an httpOnly cookie and is
 * sent to the backend as a bearer token. The login endpoint is not proxied: its token must not reach JavaScript,
 * `/api/auth/login` handles it.
 */

import type { NextRequest } from "next/server"
import { backendHeaders, backendUrl, errorResponse, isSameOrigin } from "@/lib/server/backend"

/** Backend paths the browser must not call directly. */
const BLOCKED_PATHS: ReadonlySet<string> = new Set(["/api/v1/login/access-token"])

/** Methods that cannot change state, so they skip the CSRF check and are sent without a body. */
const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"])

/** Response headers that describe the backend connection, not the body that is passed on. */
const DROPPED_RESPONSE_HEADERS: ReadonlySet<string> = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "set-cookie",
  "transfer-encoding",
])

/**
 * Checks a request path against the blocked ones the way the backend will read it.
 * @description The backend decodes percent-escapes and redirects away extra slashes, so "/login/access%2Dtoken" and
 * "/login/access-token//" reach the same route as the plain path.
 * @param pathname - The path of the request URL, still percent-encoded.
 * @returns True for a blocked path in any spelling, and for a path that cannot be decoded.
 */
function isBlockedPath(pathname: string): boolean {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return true
  }
  return BLOCKED_PATHS.has(decoded.replace(/\/{2,}/g, "/").replace(/\/$/, ""))
}

/**
 * Forwards one request to the backend and streams the answer back.
 * @param request - The incoming request.
 * @returns The backend's response, 403 for a cross-site write, 404 for a blocked path, 502 if the backend is down.
 */
async function proxy(request: NextRequest): Promise<Response> {
  const { pathname, search } = request.nextUrl
  if (isBlockedPath(pathname)) {
    return errorResponse(404, "Not Found")
  }
  const isSafe: boolean = SAFE_METHODS.has(request.method)
  if (!isSafe && !isSameOrigin(request)) {
    return errorResponse(403, "Cross-site request rejected")
  }

  let response: Response
  try {
    response = await fetch(backendUrl(`${pathname}${search}`), {
      method: request.method,
      headers: backendHeaders(request),
      body: isSafe ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    })
  } catch (error) {
    console.error(`API proxy: ${request.method} ${pathname} failed: ${String(error)}`)
    return errorResponse(502, "The service is temporarily unavailable")
  }

  const headers: Headers = new Headers()
  response.headers.forEach((value: string, name: string): void => {
    if (!DROPPED_RESPONSE_HEADERS.has(name)) {
      headers.set(name, value)
    }
  })
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export { proxy as DELETE, proxy as GET, proxy as HEAD, proxy as PATCH, proxy as POST, proxy as PUT }

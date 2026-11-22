/**
 * @file Session check: tells the browser whether it holds the auth cookie, which JavaScript cannot read (httpOnly).
 * @description Only the presence of the cookie is checked, as `proxy.ts` does; an expired token is caught by the
 * first API request (401 -> logout). The token itself never leaves the server.
 */

import { type NextRequest, NextResponse } from "next/server"
import { AUTH_COOKIE } from "@/lib/server/backend"

/**
 * Answers whether the request carries the auth cookie.
 * @param request - The incoming request.
 * @returns `{ authenticated }`, never cached.
 */
export function GET(request: NextRequest): Response {
  return NextResponse.json(
    { authenticated: request.cookies.has(AUTH_COOKIE) },
    { headers: { "Cache-Control": "no-store" } },
  )
}

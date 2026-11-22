/**
 * @file Logout: revokes the access token at the backend and deletes the auth cookie.
 * @description The backend raises the user's token version, so a copy of the token stops working too (a logout
 * from all devices). The cookie is deleted even when the backend cannot be reached.
 */

import { type NextRequest, NextResponse } from "next/server"
import {
  AUTH_COOKIE,
  backendHeaders,
  backendUrl,
  errorResponse,
  IS_PRODUCTION,
  isSameOrigin,
} from "@/lib/server/backend"

/**
 * Logs the user out.
 * @param request - The incoming request.
 * @returns 204 without the auth cookie, or 403 for a cross-site request.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) {
    return errorResponse(403, "Cross-site request rejected")
  }
  if (request.cookies.has(AUTH_COOKIE)) {
    try {
      await fetch(backendUrl("/api/v1/logout"), { method: "POST", headers: backendHeaders(request), cache: "no-store" })
    } catch (error) {
      console.error(`Logout: backend request failed: ${String(error)}`)
    }
  }
  const response: NextResponse = new NextResponse(null, { status: 204 })
  // The attributes must match the ones the login route used, or the browser keeps the cookie
  response.cookies.set(AUTH_COOKIE, "", { httpOnly: true, secure: IS_PRODUCTION, path: "/", maxAge: 0 })
  return response
}

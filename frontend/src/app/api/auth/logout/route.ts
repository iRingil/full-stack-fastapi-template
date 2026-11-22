/**
 * @file Logout: deletes the auth cookie (the backend keeps no sessions, so there is nothing to revoke there).
 */

import { type NextRequest, NextResponse } from "next/server"
import { AUTH_COOKIE, errorResponse, isSameOrigin } from "@/lib/server/backend"

/**
 * Logs the user out.
 * @param request - The incoming request.
 * @returns 204 without the auth cookie, or 403 for a cross-site request.
 */
export function POST(request: NextRequest): Response {
  if (!isSameOrigin(request)) {
    return errorResponse(403, "Cross-site request rejected")
  }
  const response: NextResponse = new NextResponse(null, { status: 204 })
  // The path must match the one the login route used, or the browser keeps the cookie
  response.cookies.set(AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 })
  return response
}

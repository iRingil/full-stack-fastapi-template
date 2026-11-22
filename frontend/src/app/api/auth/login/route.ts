/**
 * @file Login: exchanges the credentials for the backend's access token and stores it in an httpOnly cookie.
 * @description Takes the same `application/x-www-form-urlencoded` body as the backend's OAuth2 endpoint
 * (`username`, `password`). Answers 204 on success; backend errors are passed through unchanged.
 */

import { type NextRequest, NextResponse } from "next/server"
import type { Token } from "@/client"
import {
  AUTH_COOKIE,
  backendHeaders,
  backendUrl,
  errorResponse,
  IS_PRODUCTION,
  isSameOrigin,
  tokenMaxAge,
} from "@/lib/server/backend"

/**
 * Logs the user in.
 * @param request - The login form.
 * @returns 204 with the auth cookie, the backend's error, 403 for a cross-site request or 502 if the backend is down.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) {
    return errorResponse(403, "Cross-site request rejected")
  }
  const headers: Headers = backendHeaders(request)
  headers.delete("authorization")
  headers.set("content-type", "application/x-www-form-urlencoded")

  let response: Response
  try {
    response = await fetch(backendUrl("/api/v1/login/access-token"), {
      method: "POST",
      headers,
      body: await request.text(),
      cache: "no-store",
    })
  } catch (error) {
    console.error(`Login: backend request failed: ${String(error)}`)
    return errorResponse(502, "The service is temporarily unavailable")
  }
  if (!response.ok) {
    return new Response(response.body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    })
  }

  const { access_token: token }: Token = await response.json()
  const result: NextResponse = new NextResponse(null, { status: 204 })
  result.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: tokenMaxAge(token),
  })
  return result
}

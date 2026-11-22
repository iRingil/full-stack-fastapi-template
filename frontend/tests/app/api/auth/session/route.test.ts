// @vitest-environment node

import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { GET } from "@/app/api/auth/session/route"

/**
 * Builds a session request.
 * @param cookie - The Cookie header, if any.
 * @returns The request.
 */
function sessionRequest(cookie?: string): NextRequest {
  return new NextRequest("http://site/api/auth/session", { headers: cookie ? { cookie } : {} })
}

describe("session route", () => {
  it("reports a logged-in browser without revealing the token", async () => {
    const response = GET(sessionRequest("access_token=secret-token"))
    expect(response.headers.get("cache-control")).toBe("no-store")
    const body: string = await response.text()
    expect(JSON.parse(body)).toEqual({ authenticated: true })
    expect(body).not.toContain("secret-token")
  })

  it("reports a guest", async () => {
    expect(await GET(sessionRequest()).json()).toEqual({ authenticated: false })
  })
})

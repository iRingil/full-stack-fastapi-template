// @vitest-environment node

import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { POST } from "@/app/api/auth/logout/route"

describe("logout route", () => {
  it("expires the auth cookie on the whole site", () => {
    const response = POST(new NextRequest("http://site/api/auth/logout", { method: "POST" }))
    expect(response.status).toBe(204)
    const cookie = response.headers.get("set-cookie") ?? ""
    expect(cookie).toContain("access_token=;")
    expect(cookie).toContain("Path=/")
    expect(cookie).toContain("Max-Age=0")
  })

  it("rejects a cross-site logout", () => {
    const request = new NextRequest("http://site/api/auth/logout", {
      method: "POST",
      headers: { origin: "https://evil.test", host: "site" },
    })
    expect(POST(request).status).toBe(403)
  })
})

// @vitest-environment node

import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/auth/logout/route"

const fetchMock = vi.fn()

beforeEach((): void => {
  vi.stubEnv("API_URL", "http://backend:8000")
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
  vi.spyOn(console, "error").mockImplementation((): void => undefined)
})

/**
 * Builds a same-origin logout request.
 * @param cookie - The Cookie header, if any.
 * @returns The request.
 */
function logoutRequest(cookie?: string): NextRequest {
  return new NextRequest("http://site/api/auth/logout", { method: "POST", headers: cookie ? { cookie } : {} })
}

describe("logout route", () => {
  it("revokes the token at the backend and expires the auth cookie on the whole site", async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"Logged out"}', { status: 200 }))

    const response = await POST(logoutRequest("access_token=tok"))

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe("http://backend:8000/api/v1/logout")
    expect(init.method).toBe("POST")
    expect(init.headers.get("authorization")).toBe("Bearer tok")
    expect(response.status).toBe(204)
    const cookie = response.headers.get("set-cookie") ?? ""
    expect(cookie).toContain("access_token=;")
    expect(cookie).toContain("Path=/")
    expect(cookie).toContain("Max-Age=0")
  })

  it("does not call the backend without a token", async () => {
    const response = await POST(logoutRequest())
    expect(fetchMock).not.toHaveBeenCalled()
    expect(response.status).toBe(204)
  })

  it("still deletes the cookie when the backend is down", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    const response = await POST(logoutRequest("access_token=tok"))

    expect(response.status).toBe(204)
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0")
    expect(console.error).toHaveBeenCalledWith("Logout: backend request failed: TypeError: fetch failed")
  })

  it("rejects a cross-site logout", async () => {
    const request = new NextRequest("http://site/api/auth/logout", {
      method: "POST",
      headers: { origin: "https://evil.test", host: "site", cookie: "access_token=tok" },
    })
    expect((await POST(request)).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

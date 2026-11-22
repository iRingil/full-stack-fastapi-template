// @vitest-environment node

import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/auth/login/route"
import { fakeJwt } from "../../../../testUtils"

const fetchMock = vi.fn()

/**
 * Builds a same-origin login request.
 * @param headers - Extra headers.
 * @returns The request.
 */
function loginRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://site/api/auth/login", {
    method: "POST",
    headers: { origin: "http://site", host: "site", cookie: "access_token=old", ...headers },
    body: "username=a%40example.com&password=secret12",
  })
}

beforeEach((): void => {
  vi.stubEnv("API_URL", "http://backend:8000")
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
})

describe("login route", () => {
  it("stores the token in an httpOnly cookie that expires with it", async () => {
    const token = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
    fetchMock.mockResolvedValue(Response.json({ access_token: token, token_type: "bearer" }))

    const response = await POST(loginRequest())

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe("http://backend:8000/api/v1/login/access-token")
    expect(init.body).toBe("username=a%40example.com&password=secret12")
    expect(init.headers.get("content-type")).toBe("application/x-www-form-urlencoded")
    expect(init.headers.has("authorization")).toBe(false)
    expect(response.status).toBe(204)
    const cookie = response.headers.get("set-cookie") ?? ""
    expect(cookie).toContain(`access_token=${token}`)
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("SameSite=lax")
    expect(cookie).toMatch(/Max-Age=35\d\d/)
  })

  it("passes a backend error through", async () => {
    fetchMock.mockResolvedValue(Response.json({ detail: "Incorrect email or password" }, { status: 400 }))
    const response = await POST(loginRequest())
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ detail: "Incorrect email or password" })
    expect(response.headers.has("set-cookie")).toBe(false)
  })

  it("labels a backend error without a content type as JSON", async () => {
    // A byte body gets no content type, unlike a string one
    fetchMock.mockResolvedValue(new Response(new TextEncoder().encode('{"detail":"x"}'), { status: 400 }))
    const response = await POST(loginRequest())
    expect(response.headers.get("content-type")).toBe("application/json")
  })

  it("rejects a cross-site login", async () => {
    const response = await POST(loginRequest({ origin: "https://evil.test" }))
    expect(response.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("answers 502 when the backend is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))
    expect((await POST(loginRequest())).status).toBe(502)
  })
})

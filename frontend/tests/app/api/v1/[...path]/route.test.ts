// @vitest-environment node

import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DELETE, GET, POST } from "@/app/api/v1/[...path]/route"

const fetchMock = vi.fn()

beforeEach((): void => {
  vi.stubEnv("API_URL", "http://backend:8000")
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
})

describe("API proxy", () => {
  it("forwards a GET with the bearer token and streams the answer back", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"count":0}', {
        status: 200,
        headers: { "content-type": "application/json", "content-encoding": "gzip", "set-cookie": "x=1" },
      }),
    )
    const request = new NextRequest("http://site/api/v1/items/?skip=0", { headers: { cookie: "access_token=tok" } })

    const response = await GET(request)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe("http://backend:8000/api/v1/items/?skip=0")
    expect(init.method).toBe("GET")
    expect(init.body).toBeUndefined()
    expect(init.headers.get("authorization")).toBe("Bearer tok")
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"count":0}')
    expect(response.headers.get("content-type")).toBe("application/json")
    expect(response.headers.has("content-encoding")).toBe(false)
    expect(response.headers.has("set-cookie")).toBe(false)
  })

  it("forwards the body of a same-origin write", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }))
    const request = new NextRequest("http://site/api/v1/items/", {
      method: "POST",
      headers: { origin: "http://site", host: "site", "content-type": "application/json" },
      body: '{"title":"x"}',
    })

    const response = await POST(request)

    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(new TextDecoder().decode(init.body)).toBe('{"title":"x"}')
    expect(response.status).toBe(201)
  })

  it("rejects a cross-site write without calling the backend", async () => {
    const request = new NextRequest("http://site/api/v1/items/x", {
      method: "DELETE",
      headers: { origin: "https://evil.test", host: "site" },
    })
    const response = await DELETE(request)
    expect(response.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // Every spelling the backend would route to the token endpoint, and a path that cannot be decoded. The dot segments
  // (also percent-encoded) are resolved by the request URL before the handler runs, so they cannot get around the block
  it.each([
    "/api/v1/login/access-token",
    "/api/v1/items/../login/access-token",
    "/api/v1/items/%2e%2e/login/access-token",
    "/api/v1/items/%2E%2e/login/access-token",
    "/api/v1/login/access-token/",
    "/api/v1/login/access-token//",
    "/api/v1/login//access-token",
    "/api/v1/login/access%2Dtoken",
    "/api/v1/login/access-token%2F",
    "/api/v1/login/%E0%A4%A",
  ])("does not proxy %s", async (path) => {
    const response = await POST(new NextRequest(`http://site${path}`, { method: "POST" }))
    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("answers 502 when the backend is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))
    const response = await GET(new NextRequest("http://site/api/v1/users/me"))
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ detail: "The service is temporarily unavailable" })
  })
})

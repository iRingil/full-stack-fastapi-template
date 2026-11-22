// @vitest-environment node

import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AUTH_COOKIE, backendHeaders, backendUrl, errorResponse, isSameOrigin, tokenMaxAge } from "@/lib/server/backend"
import { fakeJwt } from "../../testUtils"

afterEach((): void => {
  vi.unstubAllEnvs()
})

describe("backendUrl", () => {
  it("resolves the path against API_URL", () => {
    vi.stubEnv("API_URL", "http://backend:8000")
    expect(backendUrl("/api/v1/items/?skip=0").toString()).toBe("http://backend:8000/api/v1/items/?skip=0")
  })

  it("fails without API_URL", () => {
    vi.stubEnv("API_URL", "")
    expect(() => backendUrl("/x")).toThrow("API_URL is not set")
  })
})

describe("backendHeaders", () => {
  it("passes the allowed headers and turns the cookie into a bearer token", () => {
    const request = new NextRequest("http://site/api/v1/users/me", {
      headers: {
        accept: "application/json",
        "x-forwarded-for": "203.0.113.7",
        "x-secret": "no",
        cookie: `${AUTH_COOKIE}=tok; other=1`,
      },
    })
    const headers = backendHeaders(request)
    expect(headers.get("accept")).toBe("application/json")
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.7")
    expect(headers.get("authorization")).toBe("Bearer tok")
    expect(headers.has("x-secret")).toBe(false)
    expect(headers.has("cookie")).toBe(false)
  })

  it("sends no authorization without the cookie", () => {
    expect(backendHeaders(new NextRequest("http://site/x")).has("authorization")).toBe(false)
  })
})

describe("isSameOrigin", () => {
  const request = (headers: Record<string, string>): NextRequest => new NextRequest("http://site/x", { headers })

  it("accepts requests without Origin and from the same host", () => {
    expect(isSameOrigin(request({}))).toBe(true)
    expect(isSameOrigin(request({ origin: "http://site.test", host: "site.test" }))).toBe(true)
    expect(isSameOrigin(request({ origin: "https://site.test", host: "proxy", "x-forwarded-host": "site.test" }))).toBe(
      true,
    )
  })

  it("rejects another or a malformed origin", () => {
    expect(isSameOrigin(request({ origin: "https://evil.test", host: "site.test" }))).toBe(false)
    expect(isSameOrigin(request({ origin: "not a url", host: "site.test" }))).toBe(false)
  })
})

describe("tokenMaxAge", () => {
  it("counts the seconds until exp", () => {
    expect(tokenMaxAge(fakeJwt({ exp: 1_000 }), 400_000)).toBe(600)
    expect(tokenMaxAge(fakeJwt({ exp: 1 }), 400_000)).toBe(0)
  })

  it.each(["nodots", "a.%%%.c", fakeJwt({ sub: "x" })])("is undefined for %s", (token) => {
    expect(tokenMaxAge(token)).toBeUndefined()
  })
})

describe("errorResponse", () => {
  it("answers in FastAPI's shape", async () => {
    const response = errorResponse(502, "down")
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ detail: "down" })
  })
})

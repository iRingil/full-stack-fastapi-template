import { describe, expect, it, vi } from "vitest"
import { requestLogin, requestLogout, requestSession } from "@/lib/auth-client"
import { jsonResponse } from "../testUtils"

describe("requestLogin", () => {
  it("posts the form to the login route", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }))
    await requestLogin({ username: "a@example.com", password: "secret12" })
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(url).toBe("/api/auth/login")
    expect(init?.method).toBe("POST")
    expect(String(init?.body)).toBe("username=a%40example.com&password=secret12")
  })

  it("throws the backend's JSON error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ detail: "Incorrect email or password" }, 400))
    await expect(requestLogin({ username: "a", password: "b" })).rejects.toMatchObject({
      status: 400,
      detail: "Incorrect email or password",
    })
  })

  it("throws a text error body as is", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Bad Gateway", { status: 502 }))
    await expect(requestLogin({ username: "a", password: "b" })).rejects.toMatchObject({
      status: 502,
      detail: "Bad Gateway",
    })
  })

  it("turns a network failure into status 0", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"))
    await expect(requestLogin({ username: "a", password: "b" })).rejects.toMatchObject({ status: 0 })
  })
})

describe("requestLogout", () => {
  it("posts to the logout route", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }))
    await requestLogout()
    expect(fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" })
  })

  it("ignores a network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"))
    await expect(requestLogout()).resolves.toBeUndefined()
  })
})

describe("requestSession", () => {
  it("reads the answer of the session route", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ authenticated: true }))
    expect(await requestSession()).toBe(true)
    expect(fetch).toHaveBeenCalledWith("/api/auth/session", { cache: "no-store" })
  })

  it("counts a guest, a malformed answer and a network failure as logged out", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ authenticated: false }))
    expect(await requestSession()).toBe(false)
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("not json"))
    expect(await requestSession()).toBe(false)
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("offline"))
    expect(await requestSession()).toBe(false)
  })
})

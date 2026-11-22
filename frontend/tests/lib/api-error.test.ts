import { describe, expect, it } from "vitest"
import { client } from "@/client/client.gen"
import { ApiError, detailMessage, errorKey, installApiErrors } from "@/lib/api-error"
import { jsonResponse } from "../testUtils"

describe("detailMessage", () => {
  it("reads a string detail", () => {
    expect(detailMessage({ detail: "Incorrect password" })).toBe("Incorrect password")
  })

  it("joins the messages of a 422 response", () => {
    const body = { detail: [{ loc: ["body", "email"], msg: "bad email" }, { msg: "too short" }, { msg: 1 }] }
    expect(detailMessage(body)).toBe("bad email; too short")
  })

  it("takes a non-empty text body", () => {
    expect(detailMessage(" Bad Gateway ")).toBe("Bad Gateway")
    expect(detailMessage("  ")).toBeUndefined()
  })

  it.each([null, 42, {}, { detail: 5 }, { detail: [] }])("returns undefined for %j", (body) => {
    expect(detailMessage(body)).toBeUndefined()
  })
})

describe("ApiError", () => {
  it("keeps the status and the backend message", () => {
    const error = new ApiError(400, { detail: "Inactive user" })
    expect(error.status).toBe(400)
    expect(error.detail).toBe("Inactive user")
    expect(error.message).toBe("Inactive user")
    expect(error.name).toBe("ApiError")
  })

  it("has no detail for a network error", () => {
    const error = new ApiError(0, new TypeError("fetch failed"))
    expect(error.detail).toBeUndefined()
    expect(error.message).toBe("Request failed with status 0")
  })
})

describe("errorKey", () => {
  it.each([
    ["Incorrect email or password", 400, "incorrectCredentials"],
    ["Too many failed login attempts. Please try again later.", 429, "tooManyLoginAttempts"],
    ["User with this email already exists", 409, "emailTaken"],
    ["Invalid token", 400, "invalidResetToken"],
  ])("knows the backend's message %j", (detail, status, key) => {
    expect(errorKey(new ApiError(status, { detail }))).toBe(key)
  })

  it("finds the common password among the messages of a 422", () => {
    const body = { detail: [{ msg: "Value error, This password is too common" }] }
    expect(errorKey(new ApiError(422, body))).toBe("commonPassword")
  })

  it.each([
    [0, "network"],
    [403, "forbidden"],
    [404, "notFound"],
    [422, "validation"],
    [429, "tooManyRequests"],
    [502, "unavailable"],
    [500, "server"],
    [400, "generic"],
  ])("falls back to the status %i for an unknown message", (status, key) => {
    expect(errorKey(new ApiError(status, { detail: "Something the frontend has never heard of" }))).toBe(key)
  })

  it("is generic for an error without a message and for other exceptions", () => {
    expect(errorKey(new ApiError(400, "  "))).toBe("generic")
    expect(errorKey(new Error("boom"))).toBe("generic")
  })
})

describe("installApiErrors", () => {
  it("turns failed client requests into ApiError, once", async () => {
    installApiErrors()
    installApiErrors()
    const fetch = async (): Promise<Response> => jsonResponse({ detail: "Not found" }, 404)
    const result = client.get({ baseUrl: "http://site", url: "/api/v1/items/x", fetch, throwOnError: true })
    await expect(result).rejects.toMatchObject({ name: "ApiError", status: 404, detail: "Not found" })
    expect(client.interceptors.error.fns.filter(Boolean)).toHaveLength(1)
  })

  it("keeps an ApiError thrown by an earlier step", async () => {
    installApiErrors()
    const original = new ApiError(418, { detail: "teapot" })
    const fetch = async (): Promise<Response> => {
      throw original
    }
    await expect(client.get({ baseUrl: "http://site", url: "/x", fetch, throwOnError: true })).rejects.toBe(original)
  })

  it("turns a network failure into status 0", async () => {
    installApiErrors()
    const fetch = async (): Promise<Response> => {
      throw new TypeError("fetch failed")
    }
    await expect(client.get({ baseUrl: "http://site", url: "/x", fetch, throwOnError: true })).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
    })
  })
})

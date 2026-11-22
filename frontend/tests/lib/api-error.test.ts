import { describe, expect, it } from "vitest"
import { client } from "@/client/client.gen"
import { ApiError, detailMessage, errorMessage, installApiErrors } from "@/lib/api-error"
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

describe("errorMessage", () => {
  it("prefers the backend message", () => {
    expect(errorMessage(new ApiError(409, { detail: "Exists" }), "fallback")).toBe("Exists")
  })

  it("falls back for other errors", () => {
    expect(errorMessage(new ApiError(500, "  "), "fallback")).toBe("fallback")
    expect(errorMessage(new Error("boom"), "fallback")).toBe("fallback")
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

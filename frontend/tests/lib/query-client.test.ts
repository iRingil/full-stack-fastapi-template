import { describe, expect, it, vi } from "vitest"
import { ApiError } from "@/lib/api-error"
import { createQueryClient, isUnauthorized } from "@/lib/query-client"

describe("isUnauthorized", () => {
  it("is true for a 401 only", () => {
    expect(isUnauthorized(new ApiError(401, {}))).toBe(true)
    expect(isUnauthorized(new ApiError(403, {}))).toBe(false)
    expect(isUnauthorized(new Error("401"))).toBe(false)
  })
})

describe("createQueryClient", () => {
  it("calls onUnauthorized when a query or mutation gets a 401", async () => {
    const onUnauthorized = vi.fn()
    const client = createQueryClient(onUnauthorized)
    await client
      .query({ queryKey: ["me"], queryFn: () => Promise.reject(new ApiError(401, {})), retry: false })
      .catch(() => undefined)
    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(new ApiError(401, {})) })
      .execute(undefined)
      .catch(() => undefined)
    await client
      .query({ queryKey: ["other"], queryFn: () => Promise.reject(new ApiError(500, {})), retry: false })
      .catch(() => undefined)
    expect(onUnauthorized).toHaveBeenCalledTimes(2)
  })

  it("reports successful queries", async () => {
    const onQuerySuccess = vi.fn()
    await createQueryClient(vi.fn(), onQuerySuccess).query({ queryKey: ["ok"], queryFn: () => 1 })
    expect(onQuerySuccess).toHaveBeenCalledTimes(1)
    // Without a callback a successful query is just fine
    await expect(createQueryClient(vi.fn()).query({ queryKey: ["ok"], queryFn: () => 2 })).resolves.toBe(2)
  })

  it("retries server and network errors but not client errors", () => {
    const retry = createQueryClient(vi.fn()).getDefaultOptions().queries?.retry as (n: number, e: unknown) => boolean
    expect(retry(0, new ApiError(404, {}))).toBe(false)
    expect(retry(0, new ApiError(502, {}))).toBe(true)
    expect(retry(0, new ApiError(0, {}))).toBe(true)
    expect(retry(2, new ApiError(502, {}))).toBe(false)
  })
})

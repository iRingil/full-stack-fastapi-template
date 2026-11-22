import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { parsePage, usePageParam } from "@/hooks/usePageParam"
import { navigation, router } from "../testUtils"

describe("parsePage", () => {
  it.each([
    ["3", 3],
    [null, 1],
    ["0", 1],
    ["-2", 1],
    ["1.5", 1],
    ["abc", 1],
  ])("reads %j as %i", (value, page) => {
    expect(parsePage(value)).toBe(page)
  })
})

describe("usePageParam", () => {
  it("reads the page and keeps the other parameters when changing it", () => {
    navigation.pathname = "/items"
    navigation.searchParams = new URLSearchParams("page=2&sort=title")
    const { result } = renderHook(() => usePageParam())

    expect(result.current[0]).toBe(2)
    act(() => result.current[1](4))
    expect(router.replace).toHaveBeenLastCalledWith("/items?page=4&sort=title", { scroll: false })
  })

  it("drops the parameter for the first page", () => {
    navigation.pathname = "/items"
    navigation.searchParams = new URLSearchParams("page=2")
    const { result } = renderHook(() => usePageParam())

    act(() => result.current[1](1))
    expect(router.replace).toHaveBeenLastCalledWith("/items", { scroll: false })
  })
})
